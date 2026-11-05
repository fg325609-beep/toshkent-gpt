"""
ToshkentGPT — LOKAL video ishlab chiqaruvchi (worker).

Bu dastur SIZNING kompyuteringizda ishlaydi va rasmdan video yasaydi.
Hech qanday API kalit, hech qanday oylik to'lov kerak emas.

ENG MUHIM XUSUSIYATI — O'ZI MOSLASHADI:
  * NVIDIA karta topilsa      -> CUDA (eng tez, eng sifatli)
  * AMD karta (Windows)       -> DirectML
  * Hech narsa topilmasa      -> CPU (ishlaydi, lekin juda sekin)
Va topilgan xotira hajmiga qarab sifat darajasini O'ZI tanlaydi.

Ya'ni bugun i5-12400F + RX 550 da ishga tushadi (sekin, past sifatda),
ertaga RTX 5090 qo'ysangiz — HECH NARSA O'ZGARTIRMASDAN to'liq
quvvatda ishlay boshlaydi.

Ishga tushirish:
    pip install -r requirements.txt
    python worker.py

------------------------------------------------------------
PODKAST -> KLIP (Opus Clip uslubida), 5-QISM
------------------------------------------------------------
Uzun podkast/videoni oladi, matnga aylantiradi (faster-whisper), Gemini
yordamida eng kuchli "hook" joylarni tanlaydi, har birini kesib, so'zma-so'z
sinxron subtitr, sarlavha va brend/pul "callout"larini qo'yib, tayyor
vertikal (9:16) MP4 qilib beradi.

Qo'shimcha imkoniyatlar:
  * Yuqori sifatli kodlash — NVIDIA NVENC topilsa undan, bo'lmasa libx264
    (CRF 18, lanczos, 48 kHz AAC 192k, ovoz balandligi tekislanadi).
  * Pauzalarni o'zi kesadi ("jump-cut"): so'zlar orasidagi uzun sukutlar
    qisqartiriladi, subtitrlar yangi vaqtga qayta hisoblanadi.
  * Aqlli kesish (smart crop): 9:16 / 1:1 uchun kadr yuzga qarab markazlanadi
    (OpenCV); ikki so'zlovchi aniq ajralsa — ekran ikkiga bo'linadi.
  * Har qanday hajmdagi podkast: fayl oqim bo'lib yuklanadi, klip soni
    avtomatik (clip_count=0 -> har ~8 daqiqa nutqqa 1 klip, 2..8).

Muhit o'zgaruvchilari (environment variables):
    WORKER_TOKEN          - sayt bilan umumiy parol (barcha endpointlar uchun)
    GEMINI_API_KEY        - Gemini kaliti (bo'lmasa hook'lar oddiy usulda tanlanadi)
    GEMINI_MODEL          - Gemini modeli (standart: gemini-3.6-flash)
    WHISPER_MODEL         - faster-whisper modeli: tiny/base/small/medium/large-v3
                            (standart: small; birinchi safar o'zi yuklab oladi)
    WHISPER_DEVICE        - auto | cpu | cuda (standart: auto — NVIDIA bo'lsa cuda)
    CLIPS_DIR             - natijalar papkasi (standart: worker.py yonidagi ./clips)
    CLIPS_TTL_HOURS       - eski klip papkalari necha soatdan keyin o'chirilsin (24)
    CLIPS_MAX_SOURCE_MB   - manba fayl uchun maksimal hajm, MB (8192)
    CLIPS_QUALITY         - standart sifat: fast | high | max (high)
    CLIPS_NVENC           - "0" qilinsa NVIDIA NVENC ishlatilmaydi (standart: auto)
    CLIPS_MODELS_DIR      - yuz detektori modeli saqlanadigan papka (./models)
"""

import base64
import io
import json
import math
import os
import re
import shutil
import subprocess
import threading
import time
import traceback
import uuid
from urllib.parse import urlparse

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from typing import List, Optional
from PIL import Image

app = FastAPI(title="ToshkentGPT Local Video Worker")

# Sayt (Vercel) shu workerga murojaat qila olishi uchun.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Oddiy himoya: faqat shu parolni bilgan murojaat qabul qilinadi.
WORKER_TOKEN = os.environ.get("WORKER_TOKEN", "")

# Bajarilayotgan vazifalar: {job_id: {...}}
JOBS = {}
JOBS_LOCK = threading.Lock()

_pipe = None
_device_info = None


# ============================================================
# 1-QISM: Uskunani aniqlash va sifat darajasini tanlash
# ============================================================
def detect_device():
    """CUDA -> DirectML -> CPU tartibida eng yaxshi mavjudini tanlaydi."""
    global _device_info
    if _device_info:
        return _device_info

    # Qochish yo'li: GPU (masalan DirectML) doim xotira yetmay xato bersa,
    # shuni "1" qilib qo'yib majburan protsessorga o'tkazish mumkin (sekin, lekin ishonchli).
    if os.environ.get("FORCE_CPU_VIDEO") == "1":
        _device_info = {"backend": "cpu", "device": "cpu", "name": "CPU (majburiy)", "vram_gb": 0.0, "fp16": False}
        return _device_info

    try:
        import torch
    except ImportError:
        # torch o'rnatilmagan (masalan, faqat podkast->klip uchun ishlatilsa) —
        # rasm/video modeli ishlamaydi, lekin worker va /health baribir ishga tushadi.
        _device_info = {"backend": "cpu", "device": "cpu", "name": "CPU (torch o'rnatilmagan)", "vram_gb": 0.0, "fp16": False}
        return _device_info

    # 1) NVIDIA
    if torch.cuda.is_available():
        vram_gb = torch.cuda.get_device_properties(0).total_memory / (1024 ** 3)
        _device_info = {
            "backend": "cuda",
            "device": "cuda",
            "name": torch.cuda.get_device_name(0),
            "vram_gb": round(vram_gb, 1),
            "fp16": True,
        }
        return _device_info

    # 2) AMD/Intel Windows'da (DirectML). RX 550 kabi eski kartalar shu yerda ishlaydi.
    try:
        import torch_directml  # noqa
        dml = torch_directml.device()
        _device_info = {
            "backend": "directml",
            "device": dml,
            "name": torch_directml.device_name(0),
            # DirectML orqali aniq VRAM o'qib bo'lmaydi — ehtiyotkor taxmin.
            "vram_gb": 4.0,
            "fp16": True,  # fp16 xotirani 2 barobar tejaydi — 4GB kartada shart
        }
        return _device_info
    except Exception:
        pass

    # 3) Hech narsa yo'q — protsessor
    _device_info = {
        "backend": "cpu",
        "device": "cpu",
        "name": "CPU",
        "vram_gb": 0.0,
        "fp16": False,
    }
    return _device_info


def pick_tier(info):
    """
    Mavjud xotiraga qarab sifat darajasini tanlaydi.
    Maqsad: HAR QANDAY uskunada ishga tushsin, lekin kuchlisida to'liq quvvatda.
    """
    vram = info["vram_gb"]
    backend = info["backend"]

    if backend == "cpu":
        # Protsessorda faqat eng kichik variant real — aks holda soatlab kutiladi.
        return {"name": "minimal", "frames": 8, "size": 320, "steps": 10, "offload": "sequential"}
    if vram >= 20:   # RTX 4090 / 5090
        return {"name": "ultra", "frames": 25, "size": 1024, "steps": 30, "offload": "none"}
    if vram >= 12:
        return {"name": "high", "frames": 25, "size": 768, "steps": 25, "offload": "model"}
    if vram >= 8:
        return {"name": "medium", "frames": 14, "size": 576, "steps": 20, "offload": "model"}
    # 4-6 GB (RX 550 shu yerga tushadi)
    return {"name": "low", "frames": 6, "size": 256, "steps": 10, "offload": "sequential"}


def pick_image_tier(info):
    """
    Rasm uchun daraja. Rasm modeli videodan ANCHA yengil —
    shu sabab RX 550 (4GB) da ham haqiqatan ishlaydi.
    """
    vram = info["vram_gb"]
    if info["backend"] == "cpu":
        return {"name": "cpu", "size": 512, "steps": 20}
    if vram >= 12:
        return {"name": "high", "size": 1024, "steps": 30}
    if vram >= 8:
        return {"name": "medium", "size": 768, "steps": 28}
    return {"name": "low", "size": 384, "steps": 25}   # 4-6 GB (RX 550)


# ============================================================
# 2-QISM: Modelni yuklash
# ============================================================
def get_pipeline():
    """Modelni bir marta yuklab, keyingi so'rovlarda qayta ishlatadi."""
    global _pipe
    if _pipe is not None:
        return _pipe

    import torch
    from diffusers import StableVideoDiffusionPipeline

    info = detect_device()
    tier = pick_tier(info)
    dtype = torch.float16 if info["fp16"] else torch.float32

    print(f"[worker] Uskuna: {info['name']} ({info['backend']}), daraja: {tier['name']}")
    print("[worker] Model yuklanmoqda (birinchi safar ~10 GB yuklab olinadi, sabr qiling)...")

    pipe = StableVideoDiffusionPipeline.from_pretrained(
        "stabilityai/stable-video-diffusion-img2vid-xt",
        torch_dtype=dtype,
        variant="fp16" if info["fp16"] else None,
    )

    # Xotirani tejash — kam xotirali kartalarda ishga tushishi uchun shart.
    if info["backend"] == "cuda":
        if tier["offload"] == "sequential":
            pipe.enable_sequential_cpu_offload()
        elif tier["offload"] == "model":
            pipe.enable_model_cpu_offload()
        else:
            pipe = pipe.to(info["device"])
    elif info["backend"] == "directml":
        # DirectML uchun ham offloadni sinaymiz; ishlamasa oddiy usulga qaytamiz.
        try:
            if tier["offload"] in ("sequential", "model"):
                pipe.enable_sequential_cpu_offload(device=info["device"])
            else:
                pipe = pipe.to(info["device"])
        except Exception as e:
            print(f"[worker] DirectML offload ishlamadi ({e}), oddiy usulga o'tildi.")
            pipe = pipe.to(info["device"])
    else:
        pipe = pipe.to(info["device"])

    try:
        pipe.enable_attention_slicing()
        pipe.enable_vae_slicing()
    except Exception:
        pass

    _pipe = pipe
    print("[worker] Tayyor.")
    return _pipe


# ============================================================
# 3-QISM: Video yaratish
# ============================================================
def run_job(job_id, image_b64):
    import torch
    from diffusers.utils import export_to_video

    try:
        info = detect_device()
        tier = pick_tier(info)
        pipe = get_pipeline()

        raw = base64.b64decode(image_b64.split(",", 1)[-1])
        image = Image.open(io.BytesIO(raw)).convert("RGB")

        # Rasmni daraja o'lchamiga moslab, nisbatini buzmasdan kesamiz.
        target = tier["size"]
        w, h = image.size
        scale = max(target / w, target * 9 / 16 / h)
        image = image.resize((max(1, int(w * scale)), max(1, int(h * scale))), Image.LANCZOS)
        left = (image.width - target) // 2
        top = (image.height - int(target * 9 / 16)) // 2
        image = image.crop((left, top, left + target, top + int(target * 9 / 16)))

        with JOBS_LOCK:
            JOBS[job_id]["stage"] = f"Yaratilmoqda ({tier['name']} daraja)"

        generator = torch.manual_seed(42)
        frames = pipe(
            image,
            decode_chunk_size=1,          # xotirani tejaydi
            num_frames=tier["frames"],
            num_inference_steps=tier["steps"],
            generator=generator,
        ).frames[0]

        out_dir = os.path.join(os.path.dirname(__file__), "output")
        os.makedirs(out_dir, exist_ok=True)
        out_path = os.path.join(out_dir, f"{job_id}.mp4")
        export_to_video(frames, out_path, fps=7)

        with open(out_path, "rb") as f:
            video_b64 = base64.b64encode(f.read()).decode()

        with JOBS_LOCK:
            JOBS[job_id].update(state="done", video=video_b64, stage="Tayyor")

    except Exception as e:
        msg = str(e)
        print(f"[worker] XATO: {e}")
        if "allocate" in msg.lower() or "memory" in msg.lower():
            msg = ("Videokartangizda xotira yetmadi. worker.py'ni FORCE_CPU_VIDEO=1 bilan "
                   "ishga tushirib ko'ring (sekinroq, lekin ishonchli) yoki rasmni kichikroq qiling.")
        with JOBS_LOCK:
            JOBS[job_id].update(state="error", message=msg)



_img_pipe = None


def get_image_pipeline():
    """Rasm modeli (Stable Diffusion). Videodan yengil — 4GB kartada ham ishlaydi."""
    global _img_pipe
    if _img_pipe is not None:
        return _img_pipe

    import torch
    from diffusers import StableDiffusionPipeline

    info = detect_device()
    dtype = torch.float16 if info["fp16"] else torch.float32
    model_id = os.environ.get("IMAGE_MODEL", "stabilityai/sd-turbo")

    print(f"[worker] Rasm modeli yuklanmoqda: {model_id} ...")
    pipe = StableDiffusionPipeline.from_pretrained(model_id, torch_dtype=dtype, safety_checker=None)
    pipe = pipe.to(info["device"])
    try:
        pipe.enable_attention_slicing()
        pipe.enable_vae_slicing()
    except Exception:
        pass

    _img_pipe = pipe
    print("[worker] Rasm modeli tayyor.")
    return _img_pipe


def run_image_job(job_id, prompt):
    try:
        info = detect_device()
        tier = pick_image_tier(info)
        pipe = get_image_pipeline()

        with JOBS_LOCK:
            JOBS[job_id]["stage"] = f"Chizilmoqda ({tier['name']})"

        # sd-turbo 1-4 qadamda ishlaydi; oddiy SD uchun ko'proq qadam kerak.
        steps = 4 if "turbo" in os.environ.get("IMAGE_MODEL", "sd-turbo") else tier["steps"]
        guidance = 0.0 if "turbo" in os.environ.get("IMAGE_MODEL", "sd-turbo") else 7.5

        def _generate(p, size):
            return p(
                prompt=prompt,
                width=size,
                height=size,
                num_inference_steps=steps,
                guidance_scale=guidance,
            ).images[0]

        try:
            image = _generate(pipe, tier["size"])
        except Exception as gpu_err:
            # Video xotira yetmasa — VA'DA QILINGANIDEK protsessorga o'tamiz.
            # CPU sekinroq, lekin xotirasi ko'p, shuning uchun ishlaydi.
            msg = str(gpu_err).lower()
            if "memory" not in msg and "allocate" not in msg:
                raise
            print(f"[worker] Video xotira yetmadi -> protsessorga o'tilmoqda: {gpu_err}")
            with JOBS_LOCK:
                JOBS[job_id]["stage"] = "Video xotira yetmadi, protsessorda chizilmoqda (sekinroq)"

            global _img_pipe
            import torch as _t
            from diffusers import StableDiffusionPipeline as _SDP
            cpu_pipe = _SDP.from_pretrained(
                os.environ.get("IMAGE_MODEL", "stabilityai/sd-turbo"),
                torch_dtype=_t.float32,
                safety_checker=None,
            ).to("cpu")
            try:
                cpu_pipe.enable_attention_slicing()
                cpu_pipe.enable_vae_slicing()
            except Exception:
                pass
            _img_pipe = cpu_pipe          # keyingi so'rovlar ham CPU'da ishlasin
            image = _generate(cpu_pipe, 384)

        buf = io.BytesIO()
        image.save(buf, format="PNG")
        img_b64 = base64.b64encode(buf.getvalue()).decode()

        with JOBS_LOCK:
            JOBS[job_id].update(state="done", image=img_b64, stage="Tayyor")

    except Exception as e:
        print(f"[worker] RASM XATO: {e}")
        with JOBS_LOCK:
            JOBS[job_id].update(state="error", message=str(e))


# ============================================================
# 5-QISM: PODKAST -> KLIP (Opus Clip uslubida)
# ============================================================
# Oqim: yuklab olish -> audio (16 kHz wav) -> transkripsiya (faster-whisper,
# so'z vaqtlari bilan) -> hook tanlash (Gemini, bo'lmasa oddiy usul) ->
# ffmpeg bilan kesish + ASS subtitr/sarlavha/callout -> tayyor MP4 + rasm.

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.6-flash")
WHISPER_MODEL = os.environ.get("WHISPER_MODEL", "small")
WHISPER_DEVICE = os.environ.get("WHISPER_DEVICE", "auto")
CLIPS_DIR = os.path.abspath(
    os.environ.get("CLIPS_DIR") or os.path.join(os.path.dirname(os.path.abspath(__file__)), "clips")
)
CLIPS_TTL_HOURS = float(os.environ.get("CLIPS_TTL_HOURS", "24"))
CLIPS_MAX_SOURCE_MB = float(os.environ.get("CLIPS_MAX_SOURCE_MB", "8192"))
CLIPS_MODELS_DIR = os.path.abspath(
    os.environ.get("CLIPS_MODELS_DIR") or os.path.join(os.path.dirname(os.path.abspath(__file__)), "models")
)

# Kodlash sifati darajalari: libx264 (CPU) va h264_nvenc (NVIDIA) uchun alohida.
CLIP_QUALITY_PRESETS = {
    "fast": {"x264": ["-preset", "veryfast", "-crf", "22"],
             "nvenc": ["-preset", "p1", "-rc", "vbr", "-cq", "23", "-b:v", "0", "-maxrate", "10M", "-bufsize", "20M"]},
    "high": {"x264": ["-preset", "medium", "-crf", "18"],
             "nvenc": ["-preset", "p5", "-rc", "vbr", "-cq", "19", "-b:v", "0", "-maxrate", "12M", "-bufsize", "24M"]},
    "max":  {"x264": ["-preset", "slow", "-crf", "16"],
             "nvenc": ["-preset", "p7", "-rc", "vbr", "-cq", "17", "-b:v", "0", "-maxrate", "16M", "-bufsize", "32M"]},
}
CLIPS_QUALITY_DEFAULT = (os.environ.get("CLIPS_QUALITY") or "high").strip().lower()
if CLIPS_QUALITY_DEFAULT not in CLIP_QUALITY_PRESETS:
    CLIPS_QUALITY_DEFAULT = "high"

# Ovoz: 48 kHz AAC 192k + EBU R128 bo'yicha balandlikni tekislash (bir o'tishli)
CLIP_AUDIO_ARGS = ["-c:a", "aac", "-b:a", "192k", "-ar", "48000"]
CLIP_LOUDNORM = "loudnorm=I=-16:TP=-1.5:LRA=11"

# Pauza kesishda bitta klipdagi maksimal bo'lak soni (ffmpeg filtr grafigi juda katta bo'lmasin)
CLIP_MAX_INTERVALS = 80

# Ranglar (ASS formati &HAABBGGRR — ya'ni BGR tartibida!)
CLIP_GOLD = "#E4A93B"      # faol so'z va sarlavha quti rangi
CLIP_TEAL = "#2F9E96"      # callout (brend/pul) quti rangi
CLIP_BG = "0x0A0A0B"       # audio-only manba uchun fon (gradient pastki rangi)
CLIP_BG_TOP = "0x1E2638"   # audio-only fon gradientining yuqori rangi

AUDIO_EXTS = {".mp3", ".m4a", ".wav", ".aac", ".ogg", ".oga", ".opus", ".flac", ".wma"}
VIDEO_EXTS = {".mp4", ".mov", ".mkv", ".webm", ".avi", ".m4v", ".mpeg", ".mpg", ".ts"}

_whisper_model = None
_whisper_lock = threading.Lock()
_whisper_device_used = None

_nvenc_ok = None            # None = hali tekshirilmagan
_ffmpeg_filters = None      # ffmpeg -filters natijasi (kesh)
_face_detector = None       # ("haar"|"yunet", funksiya) yoki None
_face_detector_tried = False
_face_lock = threading.Lock()


# ---------- umumiy yordamchilar ----------
def _ffmpeg_exe():
    """imageio-ffmpeg bilan kelgan ffmpeg, bo'lmasa PATH dagi ffmpeg."""
    try:
        import imageio_ffmpeg
        exe = imageio_ffmpeg.get_ffmpeg_exe()
        if exe and os.path.exists(exe):
            return exe
    except Exception:
        pass
    return shutil.which("ffmpeg") or "ffmpeg"


def _ffprobe_exe():
    """ffprobe faqat PATH da bo'lsa (imageio-ffmpeg uni bermaydi)."""
    return shutil.which("ffprobe")


def _ffmpeg_ok():
    try:
        subprocess.run([_ffmpeg_exe(), "-version"], capture_output=True, timeout=15)
        return True
    except Exception:
        return False


def _module_available(name):
    import importlib.util
    try:
        return importlib.util.find_spec(name) is not None
    except Exception:
        return False


def _ffmpeg_has_filter(name):
    """ffmpeg'da shu filtr bormi (masalan 'gradients', 'loudnorm'); ro'yxat bir marta o'qiladi."""
    global _ffmpeg_filters
    if _ffmpeg_filters is None:
        try:
            out = subprocess.run([_ffmpeg_exe(), "-hide_banner", "-filters"],
                                 capture_output=True, timeout=30).stdout.decode("utf-8", "replace")
            _ffmpeg_filters = set(re.findall(r"^\s*[A-Z.]{3}\s+(\S+)\s", out, re.M))
        except Exception:
            _ffmpeg_filters = set()
    return name in _ffmpeg_filters


def _nvenc_available():
    """
    NVIDIA NVENC bilan kodlash mumkinmi? Bir marta tekshiriladi:
    1) `ffmpeg -encoders` ro'yxatida h264_nvenc bo'lishi kerak;
    2) 1 kadrli sinov kodlash muvaffaqiyatli tugashi kerak (drayver/karta haqiqatan bor).
    CLIPS_NVENC=0 bo'lsa umuman ishlatilmaydi.
    """
    global _nvenc_ok
    if _nvenc_ok is not None:
        return _nvenc_ok
    if (os.environ.get("CLIPS_NVENC") or "auto").strip().lower() in ("0", "off", "no", "false"):
        _nvenc_ok = False
        return False
    try:
        ff = _ffmpeg_exe()
        enc = subprocess.run([ff, "-hide_banner", "-encoders"], capture_output=True, timeout=30)
        if "h264_nvenc" not in enc.stdout.decode("utf-8", "replace"):
            _nvenc_ok = False
            return False
        test = subprocess.run(
            [ff, "-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "color=c=black:s=256x256:r=30:d=0.1",
             "-frames:v", "1", "-c:v", "h264_nvenc", "-f", "null", "-"],
            capture_output=True, timeout=60,
        )
        _nvenc_ok = test.returncode == 0
    except Exception:
        _nvenc_ok = False
    print(f"[klip] NVENC: {'bor — GPU bilan kodlanadi' if _nvenc_ok else 'yo‘q — libx264 (CPU)'}")
    return _nvenc_ok


def _opencv_available():
    return _module_available("cv2")


def _run(cmd, timeout=None):
    """Tashqi buyruqni bajaradi; xato bo'lsa stderr bilan Exception beradi."""
    proc = subprocess.run(cmd, capture_output=True, timeout=timeout)
    if proc.returncode != 0:
        err = proc.stderr.decode("utf-8", "replace")[-2500:]
        raise RuntimeError(f"Buyruq xato bilan tugadi ({os.path.basename(str(cmd[0]))}):\n{err}")
    return proc


def _set_clip_stage(job_id, stage, progress):
    with JOBS_LOCK:
        job = JOBS.get(job_id)
        if job is not None:
            job["stage"] = stage
            job["progress"] = int(max(0, min(100, progress)))


def _add_clip_warning(job_id, text):
    """Vazifani to'xtatmaydigan muammolar ro'yxati (statusda 'warnings' bo'lib chiqadi)."""
    print(f"[klip] OGOHLANTIRISH ({job_id}): {text}")
    with JOBS_LOCK:
        job = JOBS.get(job_id)
        if job is not None:
            job.setdefault("warnings", []).append(str(text)[:300])


def _send_clip_callback(params, payload):
    """
    Vazifa tugagach (yoki xato bo'lsa) saytga xabar beradi — masalan Telegram'dan
    /klip buyrug'i bilan boshlangan bo'lsa, sayt tayyor kliplarni o'sha chatga
    yuboradi. callback_url bo'lmasa hech narsa qilinmaydi. Alohida ipda ishlaydi,
    chunki sayt javob berguncha (kliplarni Telegram'ga yuklash) bir necha
    daqiqa o'tishi mumkin.
    """
    url = (params or {}).get("callback_url") or ""
    if not url.lower().startswith(("http://", "https://")):
        return

    def _go():
        try:
            import requests
            requests.post(
                url,
                json=payload,
                headers={"X-Worker-Token": (params or {}).get("callback_token") or WORKER_TOKEN or ""},
                timeout=600,
            )
            print(f"[klip] callback yuborildi: {url}")
        except Exception as e:  # noqa: BLE001
            print(f"[klip] callback xatosi ({url}): {e}")

    threading.Thread(target=_go, daemon=True).start()


class ClipCancelled(Exception):
    """Foydalanuvchi vazifani bekor qildi."""


def _check_cancel(job_id):
    with JOBS_LOCK:
        job = JOBS.get(job_id)
        if job is not None and job.get("cancel"):
            raise ClipCancelled()


def _fmt_mmss(sec):
    sec = max(0, int(sec))
    return f"{sec // 60:02d}:{sec % 60:02d}"


def _hex_to_ass(hex_color, alpha="00"):
    """'#RRGGBB' -> '&HAABBGGRR' (ASS rang formati)."""
    h = hex_color.lstrip("#")
    r, g, b = h[0:2], h[2:4], h[4:6]
    return f"&H{alpha}{b}{g}{r}".upper()


def _ass_time(sec):
    """Soniya -> ASS vaqt formati H:MM:SS.cc"""
    sec = max(0.0, float(sec))
    h = int(sec // 3600)
    m = int((sec % 3600) // 60)
    s = sec % 60
    return f"{h}:{m:02d}:{s:05.2f}"


def _ass_escape(text):
    """ASS matnida maxsus belgilarni zararsizlantirish."""
    return (str(text).replace("\\", "\\\\").replace("{", "(").replace("}", ")")
            .replace("\n", " ").strip())


def _ass_path_for_filter(path):
    """
    ffmpeg 'subtitles=' filtri uchun yo'lni tayyorlaydi.
    Windows'da 'C:\\x\\y.ass' -> 'C\\:/x/y.ass' (ikki nuqta va teskari slesh
    filtr sintaksisida maxsus). Bo'shliq va boshqa belgilar ham qochiriladi.
    """
    p = path if re.match(r"^[A-Za-z]:[\\/]", path) else os.path.abspath(path)
    p = p.replace("\\", "/")
    p = p.replace(":", "\\:")
    for ch in ("'", "[", "]", ",", ";"):
        p = p.replace(ch, "\\" + ch)
    return p


def _cleanup_old_clip_jobs():
    """CLIPS_TTL_HOURS dan eski papkalarni o'chiradi (yangi vazifa boshlanganda)."""
    try:
        if not os.path.isdir(CLIPS_DIR):
            return
        cutoff = time.time() - CLIPS_TTL_HOURS * 3600
        for name in os.listdir(CLIPS_DIR):
            path = os.path.join(CLIPS_DIR, name)
            try:
                if os.path.isdir(path) and os.path.getmtime(path) < cutoff:
                    with JOBS_LOCK:
                        active = JOBS.get(name, {}).get("state") == "pending"
                    if not active:
                        shutil.rmtree(path, ignore_errors=True)
                        print(f"[klip] Eski papka o'chirildi: {name}")
            except Exception:
                pass
    except Exception as e:
        print(f"[klip] Tozalashda xato (e'tiborsiz): {e}")


# ---------- 1) Yuklab olish ----------
def _is_direct_media_url(url):
    """To'g'ridan-to'g'ri fayl havolasimi (mp4/mp3/... bilan tugaydi yoki Blob manzili)?"""
    path = urlparse(url).path.lower()
    ext = os.path.splitext(path)[1]
    if ext in AUDIO_EXTS or ext in VIDEO_EXTS:
        return True
    host = (urlparse(url).hostname or "").lower()
    return "blob.vercel-storage.com" in host


def _is_page_url(url):
    host = (urlparse(url).hostname or "").lower()
    return any(k in host for k in ("youtube.com", "youtu.be", "youtube-nocookie.com",
                                     "instagram.com", "tiktok.com", "vimeo.com", "facebook.com", "fb.watch"))


def _download_direct(url, dest_noext, job_id):
    """Oddiy HTTP(S) faylni oqim ko'rinishida yuklab oladi."""
    import requests

    max_bytes = int(CLIPS_MAX_SOURCE_MB * 1024 * 1024)
    with requests.get(url, stream=True, timeout=(20, 120), allow_redirects=True) as r:
        r.raise_for_status()
        total = int(r.headers.get("Content-Length") or 0)
        if total and total > max_bytes:
            raise RuntimeError(f"Fayl juda katta ({total // (1024*1024)} MB). Cheklov: {int(CLIPS_MAX_SOURCE_MB)} MB.")

        ext = os.path.splitext(urlparse(url).path)[1].lower()
        if not ext or len(ext) > 6:
            ctype = (r.headers.get("Content-Type") or "").split(";")[0].strip().lower()
            ext = {
                "video/mp4": ".mp4", "video/quicktime": ".mov", "video/webm": ".webm",
                "video/x-matroska": ".mkv", "audio/mpeg": ".mp3", "audio/mp4": ".m4a",
                "audio/x-m4a": ".m4a", "audio/wav": ".wav", "audio/x-wav": ".wav",
                "audio/ogg": ".ogg", "audio/aac": ".aac",
            }.get(ctype, ".mp4")
        dest = dest_noext + ext

        done = 0
        last = 0
        with open(dest, "wb") as f:
            for chunk in r.iter_content(chunk_size=1024 * 1024):
                if not chunk:
                    continue
                f.write(chunk)
                done += len(chunk)
                if done > max_bytes:
                    raise RuntimeError(f"Fayl {int(CLIPS_MAX_SOURCE_MB)} MB cheklovidan oshdi.")
                if total and done - last > 8 * 1024 * 1024:
                    last = done
                    _set_clip_stage(job_id, f"Yuklab olinmoqda ({done * 100 // total}%)", 2 + done * 8 // total)
                    _check_cancel(job_id)
    return dest


def _download_with_ytdlp(url, dest_noext, job_id):
    """YouTube va boshqa sahifalardan yt-dlp orqali (≤1080p mp4, audio bilan)."""
    import yt_dlp

    def _hook(d):
        if d.get("status") == "downloading":
            total = d.get("total_bytes") or d.get("total_bytes_estimate") or 0
            got = d.get("downloaded_bytes") or 0
            if total:
                pct = got * 100 // total
                _set_clip_stage(job_id, f"YouTube'dan yuklab olinmoqda ({pct}%)", 2 + pct * 8 // 100)
            if total and total > CLIPS_MAX_SOURCE_MB * 1024 * 1024:
                raise RuntimeError(f"Video juda katta (> {int(CLIPS_MAX_SOURCE_MB)} MB).")
        with JOBS_LOCK:
            if JOBS.get(job_id, {}).get("cancel"):
                raise ClipCancelled()

    opts = {
        "format": "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=1080]+bestaudio/best[height<=1080]/best",
        "merge_output_format": "mp4",
        "outtmpl": dest_noext + ".%(ext)s",
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
        "progress_hooks": [_hook],
        # To'liq fayl yo'li (imageio-ffmpeg binari 'ffmpeg-win-...exe' deb nomlanadi)
        "ffmpeg_location": _ffmpeg_exe(),
        "retries": 3,
    }
    with yt_dlp.YoutubeDL(opts) as ydl:
        ydl.extract_info(url, download=True)

    folder = os.path.dirname(dest_noext)
    base = os.path.basename(dest_noext)
    for name in os.listdir(folder):
        if name.startswith(base + ".") and not name.endswith((".part", ".ytdl")):
            return os.path.join(folder, name)
    raise RuntimeError("yt-dlp faylni yuklab oldi, lekin natija topilmadi.")


def download_source(url, job_dir, job_id):
    """Manbani job papkasiga 'source.<ext>' nomi bilan yuklab oladi."""
    dest_noext = os.path.join(job_dir, "source")
    if _is_direct_media_url(url) and not _is_page_url(url):
        return _download_direct(url, dest_noext, job_id)
    if _is_page_url(url) or _module_available("yt_dlp"):
        try:
            return _download_with_ytdlp(url, dest_noext, job_id)
        except ClipCancelled:
            raise
        except Exception as e:
            if _is_page_url(url):
                raise RuntimeError(f"Sahifadan video olinmadi (yt-dlp): {str(e)[:300]}")
            print(f"[klip] yt-dlp uddalay olmadi ({e}); oddiy yuklab olishga o'tildi.")
    return _download_direct(url, dest_noext, job_id)


# ---------- 2) Audio + davomiylik ----------
def probe_duration(path):
    """Davomiylik (soniya). ffprobe bo'lmasa ffmpeg -i chiqishidan 'Duration:' o'qiladi."""
    probe = _ffprobe_exe()
    if probe:
        try:
            out = subprocess.run(
                [probe, "-v", "error", "-show_entries", "format=duration",
                 "-of", "default=noprint_wrappers=1:nokey=1", path],
                capture_output=True, timeout=60,
            ).stdout.decode("utf-8", "replace").strip()
            if out:
                return float(out)
        except Exception:
            pass
    proc = subprocess.run([_ffmpeg_exe(), "-hide_banner", "-i", path], capture_output=True, timeout=60)
    text = proc.stderr.decode("utf-8", "replace")
    m = re.search(r"Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)", text)
    if not m:
        raise RuntimeError("Fayl davomiyligini aniqlab bo'lmadi — bu video/audio faylmi?")
    return int(m.group(1)) * 3600 + int(m.group(2)) * 60 + float(m.group(3))


def probe_has_video(path):
    """Faylda video oqimi bormi (mp3/m4a uchun False)."""
    proc = subprocess.run([_ffmpeg_exe(), "-hide_banner", "-i", path], capture_output=True, timeout=60)
    text = proc.stderr.decode("utf-8", "replace")
    for line in text.splitlines():
        if "Stream #" in line and "Video:" in line:
            # mp3 ichidagi muqova rasmi (attached pic / mjpeg) video hisoblanmaydi
            if "attached pic" in line or "mjpeg" in line.lower() or "png" in line.lower():
                continue
            return True
    return False


def _parse_rate(txt):
    """'30000/1001' yoki '29.97' -> float (0 yoki noma'lum bo'lsa None)."""
    try:
        txt = str(txt or "").strip()
        if "/" in txt:
            a, b = txt.split("/", 1)
            a, b = float(a), float(b)
            return a / b if a > 0 and b > 0 else None
        v = float(txt)
        return v if v > 0 else None
    except Exception:
        return None


def probe_video_info(path):
    """
    Birinchi video oqim haqida: {"width", "height", "fps"} (aylantirish metadata'si
    hisobga olingan — telefon videolari). ffprobe bo'lmasa `ffmpeg -i` dan o'qiladi;
    hech narsa topilmasa None.
    """
    probe = _ffprobe_exe()
    if probe:
        try:
            out = subprocess.run(
                [probe, "-v", "error", "-select_streams", "v:0",
                 "-show_entries", "stream=width,height,r_frame_rate,avg_frame_rate:stream_tags=rotate:stream_side_data=rotation",
                 "-of", "json", path],
                capture_output=True, timeout=60,
            ).stdout.decode("utf-8", "replace")
            st = (json.loads(out).get("streams") or [{}])[0]
            w, h = int(st.get("width") or 0), int(st.get("height") or 0)
            if w > 0 and h > 0:
                fps = _parse_rate(st.get("avg_frame_rate")) or _parse_rate(st.get("r_frame_rate"))
                rot = 0
                try:
                    rot = int(float((st.get("tags") or {}).get("rotate") or 0))
                except Exception:
                    pass
                for sd in st.get("side_data_list") or []:
                    try:
                        rot = int(float(sd.get("rotation") or rot))
                    except Exception:
                        pass
                if abs(rot) % 180 == 90:
                    w, h = h, w
                return {"width": w, "height": h, "fps": fps}
        except Exception:
            pass
    try:
        proc = subprocess.run([_ffmpeg_exe(), "-hide_banner", "-i", path], capture_output=True, timeout=60)
        text = proc.stderr.decode("utf-8", "replace")
        for line in text.splitlines():
            if "Stream #" in line and "Video:" in line and "attached pic" not in line:
                m = re.search(r"\b(\d{2,5})x(\d{2,5})\b", line)
                f = re.search(r"([\d.]+)\s*fps", line) or re.search(r"([\d.]+)\s*tbr", line)
                if m:
                    return {"width": int(m.group(1)), "height": int(m.group(2)),
                            "fps": _parse_rate(f.group(1)) if f else None}
    except Exception:
        pass
    return None


def _pick_output_fps(vinfo, has_video):
    """Manba fps'i saqlanadi (24..60 oralig'ida); audio-only fon uchun 30."""
    if not has_video or not vinfo or not vinfo.get("fps"):
        return 30
    fps = float(vinfo["fps"])
    fps = min(60.0, max(24.0, fps))
    # O'zgaruvchan kadr tezligi (telefon, 29.83 kabi) — eng yaqin standart qiymatga yaxlitlanadi
    for std in (24, 25, 29.97, 30, 50, 59.94, 60):
        if abs(fps - std) < 0.6:
            fps = std
            break
    return int(fps) if abs(fps - round(fps)) < 1e-3 else round(fps, 3)


def extract_audio(src, wav_path):
    """16 kHz mono WAV — whisper uchun eng qulay format."""
    _run([_ffmpeg_exe(), "-y", "-hide_banner", "-loglevel", "error", "-i", src,
          "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", wav_path], timeout=3600)


# ---------- 3) Transkripsiya ----------
def _whisper_device():
    """auto: NVIDIA bo'lsa cuda, aks holda cpu."""
    want = (WHISPER_DEVICE or "auto").lower()
    if want in ("cpu", "cuda"):
        return want
    try:
        import torch
        if torch.cuda.is_available():
            return "cuda"
    except Exception:
        pass
    try:
        import ctranslate2
        if ctranslate2.get_cuda_device_count() > 0:
            return "cuda"
    except Exception:
        pass
    return "cpu"


def get_whisper_model():
    """faster-whisper modelini bir marta yuklab, keshlab qo'yadi (get_pipeline kabi)."""
    global _whisper_model, _whisper_device_used
    with _whisper_lock:
        if _whisper_model is not None:
            return _whisper_model
        from faster_whisper import WhisperModel

        device = _whisper_device()
        compute = "float16" if device == "cuda" else "int8"
        print(f"[klip] Whisper modeli yuklanmoqda: {WHISPER_MODEL} ({device}, {compute}) — birinchi safar yuklab olinadi...")
        try:
            _whisper_model = WhisperModel(WHISPER_MODEL, device=device, compute_type=compute)
            _whisper_device_used = device
        except Exception as e:
            if device == "cuda":
                print(f"[klip] CUDA ishlamadi ({e}); CPU'ga o'tildi.")
                _whisper_model = WhisperModel(WHISPER_MODEL, device="cpu", compute_type="int8")
                _whisper_device_used = "cpu"
            else:
                raise
        print("[klip] Whisper tayyor.")
        return _whisper_model


def _load_wav_16k(wav_path):
    """
    16 kHz mono PCM16 WAV -> float32 numpy massiv.
    faster-whisper'ga fayl o'rniga massiv beramiz — shunda u PyAV orqali
    dekodlash qilmaydi (av/faster-whisper versiyalari mos kelmasa ham ishlaydi).
    """
    import wave
    import numpy as np

    with wave.open(wav_path, "rb") as wf:
        assert wf.getframerate() == 16000 and wf.getnchannels() == 1 and wf.getsampwidth() == 2
        raw = wf.readframes(wf.getnframes())
    return np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0


def transcribe_audio(wav_path, language, job_id, total_duration):
    """
    Natija: segments = [{"start","end","text"}], words = [{"start","end","word"}].
    So'z vaqtlari subtitr sinxroni uchun kerak.
    """
    model = get_whisper_model()
    lang = None if (not language or language == "auto") else language
    seg_iter, info = model.transcribe(
        _load_wav_16k(wav_path),
        language=lang,
        word_timestamps=True,
        vad_filter=True,
        vad_parameters={"min_silence_duration_ms": 400},
        beam_size=5,
        condition_on_previous_text=False,
    )
    segments, words = [], []
    last_report = -1e9
    started = time.time()
    # Whisper segmentlarni birma-bir (lazy) beradi — uzun podkastda ham holat
    # kamida har ~30 soniya audio uchun yangilanadi (15% -> 45% oralig'ida).
    for seg in seg_iter:
        text = (seg.text or "").strip()
        if not text:
            continue
        segments.append({"start": float(seg.start), "end": float(seg.end), "text": text})
        for w in (seg.words or []):
            wt = (w.word or "").strip()
            if wt:
                words.append({"start": float(w.start), "end": float(w.end), "word": wt})
        if total_duration and (float(seg.end) - last_report >= 30.0 or len(segments) < 5):
            last_report = float(seg.end)
            pct = min(99, int(float(seg.end) * 100 / total_duration))
            elapsed = time.time() - started
            eta = ""
            if pct >= 3 and total_duration > 600:
                remain = elapsed * (100 - pct) / pct
                eta = f", taxminan {_fmt_mmss(remain)} qoldi"
            _set_clip_stage(job_id, f"Matnga aylantirilmoqda ({pct}%, {_fmt_mmss(seg.end)} / {_fmt_mmss(total_duration)}{eta})",
                            15 + pct * 30 // 100)
        _check_cancel(job_id)
    detected = getattr(info, "language", None) or lang or "auto"
    return segments, words, detected


# ---------- 4) Hook tanlash ----------
def _snap_to_segments(start, end, segments, max_len, min_len=15.0, total=None):
    """Boshlanish/tugashni whisper segment chegaralariga yaqinlashtiradi va uzunlikni cheklaydi."""
    if not segments:
        s, e = max(0.0, start), end
    else:
        starts = [s["start"] for s in segments]
        ends = [s["end"] for s in segments]
        s = min(starts, key=lambda x: abs(x - start))
        cand_ends = [x for x in ends if x > s + 1.0]
        e = min(cand_ends, key=lambda x: abs(x - end)) if cand_ends else end
        if e - s > max_len:
            # Oxirini max_len ichiga sig'adigan eng yaqin segment oxiriga olib kelamiz
            inside = [x for x in ends if s + min_len <= x <= s + max_len]
            e = max(inside) if inside else s + max_len
    if total:
        e = min(e, total)
    if e - s < min_len:
        e = min(s + min_len, total) if total else s + min_len
    return round(s, 2), round(e, 2)


def _fallback_pick_clips(segments, words, clip_count, max_len, total):
    """
    Gemini bo'lmasa: so'z zichligi eng yuqori (ko'p va uzluksiz gapiriladigan)
    oynalarni tanlaydi, video bo'ylab teng taqsimlab.
    """
    if total <= 0:
        return []
    win = min(max_len, max(15.0, total))
    if total <= win:
        return [{"start": 0.0, "end": round(total, 2), "title": "Eng muhim joyi",
                 "hook": segments[0]["text"] if segments else "", "reason": "Butun yozuv bitta klipga sig'di"}]

    # Video 'clip_count' zonaga bo'linadi — har zonadan eng zich oyna olinadi
    zones = max(1, clip_count)
    zone_len = total / zones
    picks = []
    step = 2.0
    for z in range(zones):
        z0, z1 = z * zone_len, min(total, (z + 1) * zone_len)
        best, best_score = None, -1.0
        t = z0
        while t + win <= z1 + 1e-6 or (best is None and t <= z0):
            w_end = min(t + win, z1)
            n = sum(1 for w in words if t <= w["start"] < w_end)
            score = n / max(1.0, w_end - t)
            if score > best_score:
                best_score, best = score, (t, w_end)
            t += step
            if w_end >= z1:
                break
        if best:
            s, e = _snap_to_segments(best[0], best[1], segments, max_len, total=total)
            first = next((sg["text"] for sg in segments if sg["start"] >= s - 0.5), "")
            picks.append({"start": s, "end": e, "title": f"Muhim lahza {len(picks) + 1}",
                          "hook": first, "reason": "Gapirish zichligi eng yuqori bo'lgan oyna"})
    return picks[:clip_count]


def _gemini_post(url, body, retries=2, timeout=120):
    """
    Gemini'ga so'rov: 429 / 5xx / timeout bo'lsa 2 marta qayta urinadi
    (eksponensial kutish: 2 s, 4 s; 429 da Retry-After bo'lsa unga amal qiladi).
    Boshqa xatolar darhol ko'tariladi — chaqiruvchi oddiy usulga o'tadi.
    """
    import requests

    last_err = None
    for attempt in range(retries + 1):
        wait = 2.0 * (2 ** attempt)
        try:
            r = requests.post(url, json=body, timeout=timeout)
        except (requests.Timeout, requests.ConnectionError) as e:
            last_err = f"Gemini ulanish xatosi: {str(e)[:200]}"
        else:
            if r.status_code == 200:
                return r
            if r.status_code == 429 or r.status_code >= 500:
                last_err = f"Gemini {r.status_code}: {r.text[:300]}"
                try:
                    ra = float(r.headers.get("Retry-After") or 0)
                    if ra > 0:
                        wait = min(30.0, max(wait, ra))
                except Exception:
                    pass
            else:
                raise RuntimeError(f"Gemini {r.status_code}: {r.text[:300]}")
        if attempt < retries:
            print(f"[klip] {last_err} — {wait:.0f} s dan keyin qayta urinish ({attempt + 1}/{retries})")
            time.sleep(wait)
    raise RuntimeError(last_err or "Gemini javob bermadi")


def _gemini_pick_clips(segments, clip_count, max_len, instructions, total, language):
    """Gemini'dan JSON ko'rinishida kliplar va callout'larni so'raydi."""

    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY yo'q")

    lines = [f"[{_fmt_mmss(s['start'])}] {s['text']}" for s in segments]
    transcript = "\n".join(lines)
    # Juda uzun matn (ko'p soatlik podkast) bo'lsa — boshidan kesib tashlamaymiz,
    # butun yozuv bo'ylab teng siyraklashtiramiz (har 2-/3-... satr), shunda
    # oxiridagi kuchli joylar ham ko'rinib turadi. Chegara ~240 ming belgi.
    limit = 240000
    if len(transcript) > limit:
        step = 2
        while True:
            kept = lines[::step]
            transcript = "\n".join(kept)
            if len(transcript) <= limit or step > 12:
                break
            step += 1
        transcript = transcript[:limit] + f"\n... (transkript siyraklashtirildi: har {step}-satr)"

    prompt = f"""Sen qisqa video (Reels/Shorts/TikTok) muharririsan. Quyida uzun podkast/videoning vaqt belgili transkripti berilgan (format: [mm:ss] matn). Umumiy davomiylik: {_fmt_mmss(total)} ({int(total)} soniya). Til: {language}.

VAZIFA: aynan {clip_count} ta eng kuchli, bir-biri bilan KESISHMAYDIGAN parchani tanla. Har bir parcha:
- 15 soniyadan kam EMAS va {int(max_len)} soniyadan ko'p EMAS;
- tabiiy gap boshidan boshlanib, fikr tugagan joyda tugasin;
- kuchli "hook" bilan boshlansin: kutilmagan da'vo, aniq raqam/pul summasi, qiziq hikoya, ko'pchilik fikriga qarshi qarash, amaliy maslahat;
- o'zi mustaqil tushunarli bo'lsin (kontekstsiz ham).

Foydalanuvchining qo'shimcha istaklari: {instructions.strip() or "yo'q"}

Shuningdek, matnda tilga olingan brend nomlari, kompaniyalar, pul summalari, foizlar va raqamlar uchun "callouts" (ekranda chiqadigan qisqa yozuv, ≤4 so'z) ro'yxatini ber — ular gapirilgan vaqtda ekranda ko'rsatiladi.

Faqat quyidagi JSON ni qaytar (boshqa matn yozma):
{{"clips":[{{"start":<soniya, son>,"end":<soniya, son>,"title":"<≤6 so'z, o'zbek tilida, ekran uchun sarlavha>","hook":"<klipning birinchi gapi, transkriptdan so'zma-so'z>","reason":"<nega bu parcha kuchli, 1 gap>"}}],"callouts":[{{"time":<soniya>,"text":"<≤4 so'z, masalan brend nomi yoki summa>"}}]}}

TRANSKRIPT:
{transcript}"""

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"
    body = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.4, "response_mime_type": "application/json"},
    }
    r = _gemini_post(url, body)
    data = r.json()
    text = ""
    for part in data.get("candidates", [{}])[0].get("content", {}).get("parts", []):
        text += part.get("text", "")
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text)
    parsed = json.loads(text)

    clips = []
    for c in parsed.get("clips", []):
        try:
            s, e = float(c["start"]), float(c["end"])
        except Exception:
            continue
        if e <= s:
            continue
        s, e = _snap_to_segments(s, e, segments, max_len, total=total)
        clips.append({
            "start": s, "end": e,
            "title": str(c.get("title") or "").strip()[:60],
            "hook": str(c.get("hook") or "").strip()[:300],
            "reason": str(c.get("reason") or "").strip()[:300],
        })

    # Kesishganlarni olib tashlash (boshlanish bo'yicha tartiblab)
    clips.sort(key=lambda c: c["start"])
    kept = []
    for c in clips:
        if kept and c["start"] < kept[-1]["end"] - 0.5:
            continue
        kept.append(c)

    callouts = []
    for co in parsed.get("callouts", []):
        try:
            callouts.append({"time": float(co["time"]), "text": str(co.get("text") or "").strip()[:40]})
        except Exception:
            continue
    return kept[:clip_count], callouts


def _brand_callouts(words, brand_terms):
    """brand_terms ichidagi iboralar gapirilgan vaqtlarda callout qo'shadi (katta-kichik harf farqsiz)."""
    out = []
    terms = [t.strip() for t in (brand_terms or []) if t and t.strip()]
    if not terms or not words:
        return out
    norm = lambda s: re.sub(r"[^\w]+", "", s, flags=re.UNICODE).lower()
    wnorm = [norm(w["word"]) for w in words]
    for term in terms:
        tnorm = norm(term)
        if not tnorm:
            continue
        last_t = -999.0
        i = 0
        while i < len(words):
            hit = False
            # 1..5 so'zli oynalarni birlashtirib solishtiramiz ("Coca-Cola," + "Zero" == "cocacolazero")
            joined = ""
            for n in range(0, min(5, len(words) - i)):
                joined += wnorm[i + n]
                if joined == tnorm or (n == 0 and len(tnorm) >= 4 and tnorm in joined):
                    hit = True
                    break
                if len(joined) >= len(tnorm):
                    break
            if hit:
                t = words[i]["start"]
                if t - last_t >= 8.0:          # bir xil callout 8 soniyada bir martadan ko'p chiqmasin
                    out.append({"time": t, "text": term[:40]})
                    last_t = t
            i += 1
    return out


def _fill_missing_clips(clips, segments, words, clip_count, max_len, total):
    """Gemini yetarli klip bermasa — oddiy usuldagi, kesishmaydigan nomzodlar bilan to'ldiradi."""
    if len(clips) >= clip_count:
        return clips
    extra = _fallback_pick_clips(segments, words, clip_count * 2, max_len, total)
    for cand in extra:
        if len(clips) >= clip_count:
            break
        if all(cand["end"] <= c["start"] + 0.5 or cand["start"] >= c["end"] - 0.5 for c in clips):
            clips.append(cand)
    clips.sort(key=lambda c: c["start"])
    return clips


def choose_clips(segments, words, params, total, language, job_id):
    """Gemini -> bo'lmasa oddiy usul. Har doim brand_terms callout'larini qo'shadi."""
    clip_count, max_len = params["clip_count"], float(params["max_clip_seconds"])
    clips, callouts, used = [], [], "fallback"
    if GEMINI_API_KEY and segments:
        try:
            clips, callouts = _gemini_pick_clips(segments, clip_count, max_len, params["instructions"], total, language)
            used = "gemini"
        except Exception as e:
            print(f"[klip] Gemini ishlamadi ({e}); oddiy usulga o'tildi.")
    if not clips:
        clips = _fallback_pick_clips(segments, words, clip_count, max_len, total)
        used = "fallback"
    elif len(clips) < clip_count:
        clips = _fill_missing_clips(clips, segments, words, clip_count, max_len, total)
    if not clips:
        raise RuntimeError("Klip uchun mos joy topilmadi (nutq aniqlanmadi?).")
    callouts = callouts + _brand_callouts(words, params["brand_terms"])
    for c in clips:
        if not c.get("title"):
            c["title"] = "Muhim lahza"
    return clips, callouts, used


# ---------- 5) ASS subtitr + montaj ----------
def _ass_header(play_w, play_h, font="Arial"):
    """Uslublar: Sub (oq, qalin, qora kontur), Title (oltin quti), Callout (ko'k-yashil quti)."""
    white = "&H00FFFFFF"
    black = "&H00000000"
    gold = _hex_to_ass(CLIP_GOLD)
    teal = _hex_to_ass(CLIP_TEAL)
    dark = "&H000A0A0B"
    sub_size = int(play_h * 0.038)          # 1920 -> ~72px
    title_size = int(play_h * 0.03)
    call_size = int(play_h * 0.022)
    center_size = int(play_h * 0.034)       # audio-only: ekran o'rtasidagi doimiy sarlavha
    margin_v = int(play_h * 0.20)           # pastdan 20% — "pastki-o'rta"
    return f"""[Script Info]
ScriptType: v4.00+
PlayResX: {play_w}
PlayResY: {play_h}
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Sub,{font},{sub_size},{white},{gold},{black},&H80000000,-1,0,0,0,100,100,0,0,1,{max(2, sub_size // 14)},{max(1, sub_size // 24)},2,60,60,{margin_v},1
Style: Title,{font},{title_size},{dark},{dark},{gold},{gold},-1,0,0,0,100,100,0,0,3,{max(8, title_size // 3)},0,8,80,80,{int(play_h * 0.07)},1
Style: Callout,{font},{call_size},{white},{white},{teal},{teal},-1,0,0,0,100,100,0,0,3,{max(6, call_size // 3)},0,7,50,50,{int(play_h * 0.16)},1
Style: Center,{font},{center_size},{gold},{gold},{black},&H80000000,-1,0,0,0,100,100,1,0,1,{max(2, center_size // 16)},{max(1, center_size // 20)},5,90,90,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""


class _TimeMap:
    """
    Manba vaqti (klip boshiga nisbatan, soniya) -> chiqish vaqti.
    Pauzalar kesilganda klip bir nechta saqlanadigan bo'laklardan (keep) yig'iladi;
    subtitr, sarlavha va callout vaqtlari shu xarita orqali qayta hisoblanadi,
    shunda ular ovoz bilan sinxron qoladi. Bo'lak orasidagi (kesilgan) vaqt
    kesish nuqtasiga tushadi — xarita monoton (kamaymaydi).
    """

    def __init__(self, keep, span):
        self.keep = [(float(a), float(b)) for a, b in keep if float(b) > float(a)]
        self.span = float(span)
        if not self.keep:
            self.keep = [(0.0, self.span)]
        self._out0 = []
        acc = 0.0
        for a, b in self.keep:
            self._out0.append(acc)
            acc += b - a
        self.total = acc                      # chiqish davomiyligi

    @classmethod
    def identity(cls, span):
        return cls([(0.0, float(span))], span)

    @property
    def removed(self):
        return max(0.0, self.span - self.total)

    @property
    def is_identity(self):
        return (len(self.keep) == 1 and self.keep[0][0] <= 1e-6
                and self.keep[0][1] >= self.span - 1e-6)

    def to_out(self, t):
        t = float(t)
        if t <= self.keep[0][0]:
            return 0.0
        for (a, b), o in zip(self.keep, self._out0):
            if t < a:
                return o                      # kesilgan bo'shliqda — kesish nuqtasi
            if t <= b:
                return o + (t - a)
        return self.total


def _audio_envelope(wav_path, hop_ms=10):
    """
    16 kHz mono WAV -> (dB massiv, hop soniya): har 10 ms uchun RMS balandlik.
    Fayl 30 soniyalik bo'laklab o'qiladi — 3 soatlik podkastda ham xotira kam.
    Pauza chegaralarini whisper so'z vaqtlaridan aniqroq topish uchun ishlatiladi.
    """
    import wave
    import numpy as np

    with wave.open(wav_path, "rb") as wf:
        sr = wf.getframerate()
        hop = max(1, int(sr * hop_ms / 1000))
        block = sr * 30
        parts = []
        carry = np.zeros(0, dtype=np.float32)
        while True:
            raw = wf.readframes(block)
            if not raw:
                break
            x = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0
            if carry.size:
                x = np.concatenate([carry, x])
            n = len(x) // hop
            if n:
                fr = x[:n * hop].reshape(n, hop)
                parts.append(np.sqrt((fr * fr).mean(axis=1)))
            carry = x[n * hop:]
    env = np.concatenate(parts) if parts else np.zeros(0, dtype=np.float32)
    db = 20.0 * np.log10(env + 1e-6)
    return db, hop / float(sr)


def _longest_silent_run(db, hop, t0, t1, thr_db):
    """[t0, t1] oralig'idagi (mutlaq soniya) eng uzun 'jim' (db < thr_db) bo'lak yoki None."""
    i0, i1 = max(0, int(t0 / hop)), min(len(db), int(t1 / hop) + 1)
    if i1 - i0 < 2:
        return None
    seg = db[i0:i1]
    best, cur_start = None, None
    for k in range(len(seg) + 1):
        silent = k < len(seg) and seg[k] < thr_db
        if silent and cur_start is None:
            cur_start = k
        elif not silent and cur_start is not None:
            if best is None or (k - cur_start) > (best[1] - best[0]):
                best = (cur_start, k)
            cur_start = None
    if best is None:
        return None
    return (i0 + best[0]) * hop, (i0 + best[1]) * hop


def _plan_pause_removal(clip, words, pause_threshold=0.9, pause_keep=0.25, max_intervals=CLIP_MAX_INTERVALS, env=None):
    """
    Klip ichidagi so'zlar orasidagi uzun sukutlarni (pause_threshold dan uzun)
    pause_keep gacha qisqartirish rejasi. Klip boshi/oxiridagi 0.5 s dan uzun
    sukut ham qisqartiriladi. Natija: _TimeMap (keep bo'laklari klip boshiga nisbatan).

    env=(db, hop) berilsa (_audio_envelope) har bir nomzod bo'shliq haqiqiy audio
    bo'yicha aniqlanadi: whisper so'z chegaralari ±0.5 s xato qilishi mumkin,
    shuning uchun kesish faqat chindan jim bo'lgan qismda bo'ladi — nutq
    boshi/oxiri hech qachon kesilmaydi.
    Bo'laklar soni max_intervals dan oshsa, eng qisqa bo'shliqlar birinchi
    bo'lib tiklanadi (kesilmaydi).
    """
    cs, ce = float(clip["start"]), float(clip["end"])
    span = ce - cs
    thr = max(0.3, float(pause_threshold))
    keep_len = max(0.05, min(float(pause_keep), thr - 0.1))
    half = keep_len / 2.0

    inside = sorted(
        [{"start": max(0.0, w["start"] - cs), "end": min(span, w["end"] - cs)}
         for w in words if w["end"] > cs and w["start"] < ce],
        key=lambda w: w["start"],
    )
    if not inside:
        return _TimeMap.identity(span)

    # Audio bo'yicha "jimlik" chegarasi: nutq darajasidan 28 dB past (shovqin
    # qavatidan kamida 8 dB yuqori) — xona shovqini/musiqa fonida ham ishlaydi.
    db = hop = thr_db = None
    if env is not None:
        try:
            import numpy as np
            db, hop = env
            seg = db[int(cs / hop):int(ce / hop) + 1]
            if len(seg) >= 50:
                speech_lvl = float(np.percentile(seg, 85))
                floor = float(np.percentile(seg, 5))
                thr_db = max(floor + 8.0, speech_lvl - 28.0)
            else:
                db = None
        except Exception:
            db = None

    def _audio_cut(t0, t1, min_len, at_start=False, at_end=False):
        """[t0,t1] (klipga nisbatan) ichidagi eng uzun jim bo'lakni kesish oralig'iga aylantiradi."""
        run = _longest_silent_run(db, hop, cs + max(0.0, t0), cs + min(span, t1), thr_db)
        if not run:
            return None
        s0, s1 = run[0] - cs, run[1] - cs
        if s1 - s0 < min_len:
            return None
        a = 0.0 if (at_start and s0 <= 0.2) else s0 + half
        b = span if (at_end and s1 >= span - 0.2) else s1 - half
        if at_start and a == 0.0:
            b = s1 - keep_len
        if at_end and b == span:
            a = s0 + keep_len
        return (a, b) if b - a >= 0.2 else None

    cuts = []  # (kesish boshi, kesish oxiri) — klip boshiga nisbatan
    first, last = inside[0], inside[-1]
    # Whisper nomzod bo'shliq chegarasi: audio bor bo'lsa pastroq (so'z vaqti "shishgan"
    # bo'lsa ham haqiqiy pauza audio bo'yicha tasdiqlanadi), bo'lmasa thr ning o'zi.
    cand = max(0.4, thr / 2.0) if db is not None else thr

    if first["start"] > 0.5 + keep_len:
        c = _audio_cut(0.0, first["start"] + 0.3, 0.5 + keep_len, at_start=True) if db is not None \
            else (0.0, first["start"] - keep_len)
        if c:
            cuts.append(c)
    prev = first
    for w in inside[1:]:
        gap = w["start"] - prev["end"]
        if gap > cand:
            if db is not None:
                c = _audio_cut(max(prev["start"], prev["end"] - 0.7), min(w["end"], w["start"] + 0.5), thr)
            else:
                c = (prev["end"] + half, w["start"] - half) if gap - keep_len >= 0.3 else None
            if c:
                cuts.append(c)
        if w["end"] > prev["end"]:
            prev = w
    if span - last["end"] > 0.5 + keep_len:
        c = _audio_cut(last["end"] - 0.3, span, 0.5 + keep_len, at_end=True) if db is not None \
            else (last["end"] + keep_len, span)
        if c:
            cuts.append(c)

    # Tartiblab, kesishganlarni birlashtiramiz
    cuts = sorted((a, b) for a, b in cuts if b - a >= 0.2)
    merged = []
    for a, b in cuts:
        if merged and a <= merged[-1][1]:
            merged[-1] = (merged[-1][0], max(merged[-1][1], b))
        else:
            merged.append((a, b))
    cuts = merged
    if len(cuts) > max_intervals - 1:
        # Eng qisqa bo'shliqlardan voz kechamiz (ular kam vaqt tejaydi)
        cuts.sort(key=lambda c: c[1] - c[0], reverse=True)
        cuts = cuts[:max_intervals - 1]
        cuts.sort()
    if not cuts:
        return _TimeMap.identity(span)

    keep, pos = [], 0.0
    for a, b in cuts:
        if a - pos > 0.05:
            keep.append((pos, a))
        pos = b
    if span - pos > 0.05:
        keep.append((pos, span))
    return _TimeMap(keep, span)


def _group_words(words, max_words=4, max_chars=22, max_gap=0.9):
    """So'zlarni 3-5 tadan (ekranga sig'adigan) qatorlarga bo'ladi."""
    lines, cur = [], []
    for w in words:
        if cur:
            chars = sum(len(x["word"]) for x in cur) + len(cur) + len(w["word"])
            gap = w["start"] - cur[-1]["end"]
            if len(cur) >= max_words or chars > max_chars or gap > max_gap:
                lines.append(cur)
                cur = []
        cur.append(w)
    if cur:
        lines.append(cur)
    return lines


def build_ass(ass_path, clip, words, callouts, play_w, play_h, with_subs=True, tm=None, audio_only=False):
    """
    Klip uchun ASS fayl yozadi (vaqtlar klip boshiga nisbatan, keyin `tm`
    (_TimeMap) orqali chiqish vaqtiga o'tkaziladi — pauzalar kesilganda ham
    subtitr ovoz bilan sinxron qoladi).
    Subtitr: har bir so'z uchun alohida satr — faol so'z oltin rangda
    (bu usul libass'da karaoke teglaridan ishonchliroq chiqadi).
    audio_only=True bo'lsa klip sarlavhasi butun klip davomida ekran o'rtasida turadi.
    """
    cs, ce = clip["start"], clip["end"]
    span = ce - cs
    if tm is None:
        tm = _TimeMap.identity(span)
    out_dur = tm.total
    gold = _hex_to_ass(CLIP_GOLD)
    events = []

    # Sarlavha (hook title) — dastlabki 2.5 soniya, yuqorida
    title = _ass_escape(clip.get("title") or "")
    if title:
        t_end = min(2.5, out_dur)
        events.append(f"Dialogue: 2,{_ass_time(0)},{_ass_time(t_end)},Title,,0,0,0,,{{\\fad(150,250)}} {title} ")
        if audio_only:
            # Rasm yo'q — sarlavha butun klip davomida o'rtada (xiraroq) turadi
            events.append(f"Dialogue: 1,{_ass_time(0)},{_ass_time(out_dur)},Center,,0,0,0,,"
                          f"{{\\fad(300,300)\\alpha&H30&}}{title}")

    # Callout'lar (brend/pul) — 2.5 soniya, yuqori-chap
    for co in callouts:
        t_src = co["time"] - cs
        if 0 <= t_src < span - 0.5 and co.get("text"):
            t = tm.to_out(t_src)
            if t >= out_dur - 0.5:
                continue
            events.append(f"Dialogue: 3,{_ass_time(t)},{_ass_time(min(t + 2.5, out_dur))},Callout,,0,0,0,,"
                          f"{{\\fad(120,200)}} {_ass_escape(co['text'])} ")

    # Subtitrlar
    if with_subs:
        local = []
        for w in words:
            if w["end"] <= cs or w["start"] >= ce:
                continue
            s = tm.to_out(max(0.0, w["start"] - cs))
            e = tm.to_out(min(span, w["end"] - cs))
            if e - s < 0.05:
                e = s + 0.05
            local.append({"start": s, "end": min(e, out_dur), "word": w["word"]})
        for line in _group_words(local):
            for i, w in enumerate(line):
                parts = []
                for j, x in enumerate(line):
                    txt = _ass_escape(x["word"])
                    parts.append(f"{{\\c{gold}}}{txt}{{\\c&H00FFFFFF&}}" if j == i else txt)
                start = w["start"]
                end = line[i + 1]["start"] if i + 1 < len(line) else max(w["end"], w["start"] + 0.15)
                if end <= start:
                    end = start + 0.15
                events.append(f"Dialogue: 0,{_ass_time(start)},{_ass_time(end)},Sub,,0,0,0,,{' '.join(parts)}")

    with open(ass_path, "w", encoding="utf-8") as f:
        f.write(_ass_header(play_w, play_h))
        f.write("\n".join(events) + "\n")
    return ass_path


def _output_size(aspect):
    """Chiqish o'lchami: 9:16 -> 1080x1920, 1:1 -> 1080x1080, 16:9 -> 1920x1080."""
    if aspect == "16:9":
        return 1920, 1080
    if aspect == "1:1":
        return 1080, 1080
    return 1080, 1920


def _aspect_filter(aspect, has_video):
    """(Eski interfeys) Nisbatga mos oddiy markaziy crop/scale va chiqish o'lchami."""
    w, h = _output_size(aspect)
    if aspect == "16:9":
        vf = "scale=1920:-2" if has_video else "scale=1920:1080"
    elif aspect == "1:1":
        vf = "crop=ih:ih,scale=1080:1080" if has_video else "scale=1080:1080"
    else:
        vf = "crop=ih*9/16:ih,scale=1080:1920" if has_video else "scale=1080:1920"
    return vf, (w, h)


# ---------- 5a) Aqlli kesish (smart crop): yuzni topib kadrni markazlash ----------
def _ensure_yunet_model():
    """
    OpenCV 5.x da Haar kaskadlari yo'q — YuNet (FaceDetectorYN) ishlatiladi.
    Model (~230 KB) CLIPS_MODELS_DIR ga bir marta yuklab olinadi. Yo'l: FACE_MODEL_PATH.
    """
    path = os.environ.get("FACE_MODEL_PATH") or os.path.join(CLIPS_MODELS_DIR, "face_detection_yunet_2023mar.onnx")
    if os.path.isfile(path) and os.path.getsize(path) > 100_000:
        return path
    url = ("https://media.githubusercontent.com/media/opencv/opencv_zoo/main/models/"
           "face_detection_yunet/face_detection_yunet_2023mar.onnx")
    try:
        import requests
        os.makedirs(os.path.dirname(path), exist_ok=True)
        print(f"[klip] Yuz detektori modeli yuklab olinmoqda: {url}")
        with requests.get(url, stream=True, timeout=(15, 60)) as r:
            r.raise_for_status()
            tmp = path + ".part"
            with open(tmp, "wb") as f:
                for chunk in r.iter_content(chunk_size=256 * 1024):
                    if chunk:
                        f.write(chunk)
        if os.path.getsize(tmp) > 100_000:
            os.replace(tmp, path)
            return path
        os.remove(tmp)
    except Exception as e:
        print(f"[klip] YuNet modelini yuklab bo'lmadi ({e}); smart crop o'chiq.")
    return None


def _get_face_detector():
    """
    OpenCV yuz detektori (bir marta sinaladi, keshlanadi):
      1) Haar kaskadi (opencv-python 4.x bilan birga keladi) — asosiy yo'l;
      2) YuNet (OpenCV 5.x, modelni yuklab oladi) — zaxira;
      3) OpenCV o'rnatilmagan bo'lsa None -> kadr markazdan kesiladi.
    Natija: (nom, detect(bgr_img) -> [(x, y, w, h), ...]) yoki None.
    """
    global _face_detector, _face_detector_tried
    if _face_detector_tried:
        return _face_detector
    _face_detector_tried = True
    try:
        import cv2
    except ImportError:
        print("[klip] OpenCV yo'q — smart crop o'rniga markazdan kesiladi "
              "(ixtiyoriy: pip install \"opencv-python-headless<5\").")
        return None

    try:
        if hasattr(cv2, "CascadeClassifier"):
            xml = os.path.join(getattr(getattr(cv2, "data", None), "haarcascades", "") or "",
                               "haarcascade_frontalface_default.xml")
            if os.path.isfile(xml):
                casc = cv2.CascadeClassifier(xml)
                if not casc.empty():
                    def _haar(img):
                        # equalizeHist ishlatilmaydi — bir xil fonli kadrlarda aniqlashni buzadi
                        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
                        faces = casc.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=4, minSize=(24, 24))
                        return [(int(x), int(y), int(w), int(h)) for (x, y, w, h) in faces]
                    _face_detector = ("haar", _haar)
                    print("[klip] Yuz detektori: OpenCV Haar kaskadi")
                    return _face_detector
    except Exception as e:
        print(f"[klip] Haar kaskadi ishlamadi ({e})")

    try:
        if hasattr(cv2, "FaceDetectorYN"):
            model = _ensure_yunet_model()
            if model:
                det = cv2.FaceDetectorYN.create(model, "", (320, 320), 0.7, 0.3, 50)

                def _yunet(img):
                    h, w = img.shape[:2]
                    det.setInputSize((w, h))
                    _, faces = det.detect(img)
                    if faces is None:
                        return []
                    return [(int(f[0]), int(f[1]), int(f[2]), int(f[3])) for f in faces]
                _face_detector = ("yunet", _yunet)
                print("[klip] Yuz detektori: OpenCV YuNet")
                return _face_detector
    except Exception as e:
        print(f"[klip] YuNet ishlamadi ({e})")

    print("[klip] OpenCV bor, lekin yuz detektori topilmadi — markazdan kesiladi.")
    return None


def _detect_faces_in_clip(src, clip, work_dir, step=1.5, max_samples=40, detector=None):
    """
    Klip bo'ylab har ~step soniyada bitta kadr olinadi (bitta ffmpeg o'tishida,
    640px kenglikda) va yuzlar aniqlanadi.
    Natija: har kadr uchun ro'yxat [(markaz_x 0..1, yuz_maydoni 0..1), ...]
    (eng kattasi birinchi, ko'pi bilan 2 ta); yuz yo'q kadr -> []. Detektor yo'q -> None.
    """
    det = detector or _get_face_detector()
    if det is None:
        return None
    import cv2

    cs, ce = float(clip["start"]), float(clip["end"])
    span = max(0.5, ce - cs)
    step = max(float(step), span / float(max_samples))
    frames_dir = os.path.join(work_dir, "faces_tmp")
    shutil.rmtree(frames_dir, ignore_errors=True)
    os.makedirs(frames_dir, exist_ok=True)
    try:
        _run([_ffmpeg_exe(), "-y", "-hide_banner", "-loglevel", "error",
              "-ss", f"{cs:.3f}", "-to", f"{ce:.3f}", "-i", src,
              "-vf", f"fps={1.0 / step:.4f},scale=640:-2", "-q:v", "4",
              os.path.join(frames_dir, "f_%03d.jpg")], timeout=900)
        result = []
        for name in sorted(os.listdir(frames_dir)):
            img = cv2.imread(os.path.join(frames_dir, name))
            if img is None:
                continue
            H, W = img.shape[:2]
            with _face_lock:
                faces = det[1](img)
            min_side = max(16, int(0.05 * W))      # juda kichik (fon) yuzlarni e'tiborsiz qoldiramiz
            faces = [f for f in faces if f[2] >= min_side and f[3] >= min_side]
            faces.sort(key=lambda f: f[2] * f[3], reverse=True)
            result.append([((x + w / 2.0) / W, (w * h) / float(W * H)) for (x, y, w, h) in faces[:2]])
        return result
    finally:
        shutil.rmtree(frames_dir, ignore_errors=True)


def _median(xs):
    xs = sorted(xs)
    n = len(xs)
    if n == 0:
        return None
    return xs[n // 2] if n % 2 else (xs[n // 2 - 1] + xs[n // 2]) / 2.0


def _split_clusters(centers):
    """
    1 o'lchamli nuqtalarni (yuz markazlari) 2 guruhga ajratadi (eng kam ichki
    tarqoqlik bo'yicha). Natija: (chap_guruh, o'ng_guruh) yoki None (kam nuqta).
    """
    xs = sorted(centers)
    n = len(xs)
    if n < 4:
        return None
    best = None
    for i in range(2, n - 1):
        l, r = xs[:i], xs[i:]
        ml, mr = sum(l) / len(l), sum(r) / len(r)
        sse = sum((x - ml) ** 2 for x in l) + sum((x - mr) ** 2 for x in r)
        if best is None or sse < best[0]:
            best = (sse, i)
    i = best[1]
    return xs[:i], xs[i:]


def _choose_crop_x(centers, n_samples, min_ratio=0.3):
    """
    Yuz markazlari (0..1) bo'yicha kadr markazi: yuz kamida n_samples ning 30% ida
    topilgan bo'lsa — mediana, aks holda 0.5 (markaz).
    """
    if not centers or n_samples <= 0 or len(centers) < min_ratio * n_samples:
        return 0.5
    return float(min(1.0, max(0.0, _median(centers))))


def _choose_crop_layout(frames_faces, layout="auto", n_samples=None):
    """
    Kadrlardagi yuzlardan kesish rejasini tuzadi:
      {"layout": "single", "cx": 0..1}  yoki  {"layout": "split", "cx": A, "cx2": B}
    frames_faces: _detect_faces_in_clip natijasi (None -> detektor yo'q).
    'auto' faqat aniq holatda split tanlaydi: ikki guruh orasidagi farq kadr
    kengligining 30% dan ko'p va har guruh namunalarning kamida 30% ida bor.
    'split' majburlansa, yuzlar aniq bo'lmasa chap/o'ng yarmi olinadi.
    """
    frames = frames_faces or []
    n = n_samples if n_samples is not None else len(frames)
    main = [f[0][0] for f in frames if f]                       # har kadrdagi eng katta yuz
    allc = [c for f in frames for (c, _a) in f]                 # barcha yuzlar (2 tagacha / kadr)
    found = (len(main) / float(n)) if n else 0.0
    base = {"faces_ratio": round(found, 2), "samples": n}

    clusters = _split_clusters(allc) if allc else None
    clear = False
    if clusters:
        l, r = clusters
        ml, mr = sum(l) / len(l), sum(r) / len(r)
        clear = (abs(mr - ml) > 0.30 and len(l) >= 0.3 * n and len(r) >= 0.3 * n)

    if layout == "split":
        if clear:
            return dict(base, layout="split", cx=ml, cx2=mr)
        return dict(base, layout="split", cx=0.25, cx2=0.75)
    if found < 0.3:
        return dict(base, layout="single", cx=0.5)
    if clear:
        if layout == "auto":
            return dict(base, layout="split", cx=ml, cx2=mr)
        dominant = l if len(l) >= len(r) else r                 # ko'proq ko'ringan so'zlovchi
        return dict(base, layout="single", cx=float(_median(dominant)))
    return dict(base, layout="single", cx=_choose_crop_x(main, n))


def _plan_crop(src, clip, params, work_dir, job_id):
    """Klip uchun smart crop rejasi; xato bo'lsa markazdan kesish (vazifa to'xtamaydi)."""
    layout = params.get("layout", "auto")
    if not params.get("smart_crop", True) and layout != "split":
        return {"layout": "single", "cx": 0.5}
    try:
        frames = _detect_faces_in_clip(src, clip, work_dir)
    except ClipCancelled:
        raise
    except Exception as e:
        _add_clip_warning(job_id, f"Yuzlarni aniqlab bo'lmadi, kadr markazdan kesildi: {str(e)[:160]}")
        frames = None
    if frames is None:
        plan = _choose_crop_layout(None, layout="split" if layout == "split" else "single")
        plan["detector"] = None
        if _get_face_detector() is None:
            # Har vazifada bir marta eslatamiz (status 'warnings' da ko'rinadi)
            with JOBS_LOCK:
                already = any("OpenCV" in w for w in (JOBS.get(job_id, {}).get("warnings") or []))
            if not already:
                _add_clip_warning(job_id, "Smart crop ishlamadi: OpenCV yuz detektori yo'q — kadr markazdan kesildi "
                                          "(ixtiyoriy: pip install \"opencv-python-headless<5\").")
        return plan
    plan = _choose_crop_layout(frames, layout=layout)
    det = _get_face_detector()
    plan["detector"] = det[0] if det else None
    return plan


def _even(v):
    return max(2, int(v) // 2 * 2)


def _fit_crop(iw, ih, ar):
    """Manba (iw x ih) ichiga sig'adigan, nisbati `ar` (w/h) bo'lgan eng katta oyna (juft sonlar)."""
    cw = min(float(iw), float(ih) * ar)
    ch = cw / ar
    if ch > ih:
        ch = float(ih)
        cw = ch * ar
    return _even(cw), _even(ch)


def _crop_x_px(iw, cw, cx):
    """Markazi cx (0..1) bo'lgan cw kenglikdagi oynaning chap cheti (kadrdan chiqmaydi)."""
    x = cx * iw - cw / 2.0
    return int(round(min(max(0.0, x), max(0.0, iw - cw))))


def _crop_scale_chain(aspect, vinfo, crop=None):
    """
    Video uchun crop/scale filtr zanjiri (chiqish belgisiz; oxiriga ',subtitles=...'
    ulanadi). Manba o'lchami noma'lum bo'lsa eski ifodali markaziy crop ishlatiladi.
    """
    w, h = _output_size(aspect)
    lz = ":flags=lanczos"
    if aspect == "16:9":
        # Sig'dirib, qolgan joyni qora bilan to'ldiramiz — chiqish doim 1920x1080
        return (f"scale={w}:{h}:force_original_aspect_ratio=decrease{lz},"
                f"pad={w}:{h}:(ow-iw)/2:(oh-ih)/2:color={CLIP_BG},setsar=1")
    crop = crop or {}
    iw, ih = (vinfo or {}).get("width") or 0, (vinfo or {}).get("height") or 0
    if iw <= 0 or ih <= 0:
        base = "crop=ih:ih" if aspect == "1:1" else "crop=ih*9/16:ih"
        return f"{base},scale={w}:{h}{lz},setsar=1"

    if crop.get("layout") == "split" and aspect == "9:16":
        half = h // 2                                            # 1080x960 x 2
        cw, ch = _fit_crop(iw, ih, w / float(half))
        y = (ih - ch) // 2
        xa = _crop_x_px(iw, cw, float(crop.get("cx", 0.25)))
        xb = _crop_x_px(iw, cw, float(crop.get("cx2", 0.75)))
        return (f"split=2[_sa][_sb];"
                f"[_sa]crop={cw}:{ch}:{xa}:{y},scale={w}:{half}{lz}[_ta];"
                f"[_sb]crop={cw}:{ch}:{xb}:{y},scale={w}:{half}{lz}[_tb];"
                f"[_ta][_tb]vstack=inputs=2,setsar=1")

    cw, ch = _fit_crop(iw, ih, w / float(h))
    x = _crop_x_px(iw, cw, float(crop.get("cx", 0.5)))
    y = (ih - ch) // 2
    return f"crop={cw}:{ch}:{x}:{y},scale={w}:{h}{lz},setsar=1"


# ---------- 5b) Kodlash ----------
def _background_source(w, h, fps, dur):
    """Audio-only manba uchun fon: yumshoq vertikal gradient (bo'lmasa bir rang)."""
    d = f"{dur + 0.5:.3f}"
    if _ffmpeg_has_filter("gradients"):
        # speed juda kichik -> amalda qimirlamaydigan, tepasi ozroq yorug' fon
        return (f"gradients=s={w}x{h}:c0={CLIP_BG_TOP}:c1={CLIP_BG}:x0={w // 2}:y0=0:x1={w // 2}:y1={h}"
                f":nb_colors=2:speed=0.00001:r={fps}:d={d}")
    return f"color=c={CLIP_BG}:s={w}x{h}:r={fps}:d={d}"


def _video_codec_args(quality, fps, use_nvenc):
    """Sifat darajasi + kodlovchi -> ffmpeg argumentlari."""
    q = CLIP_QUALITY_PRESETS.get(quality) or CLIP_QUALITY_PRESETS["high"]
    level = "4.2" if float(fps) > 30 else "4.1"
    if use_nvenc:
        args = ["-c:v", "h264_nvenc"] + q["nvenc"]
    else:
        args = ["-c:v", "libx264"] + q["x264"]
    return args + ["-profile:v", "high", "-level", level, "-pix_fmt", "yuv420p",
                   "-movflags", "+faststart", "-r", str(fps)]


def render_clip(src, has_video, clip, out_mp4, thumb_jpg, ass_path, aspect,
                tm=None, quality=None, crop=None, vinfo=None):
    """
    ffmpeg: kesish (+ pauzalarni tashlab yig'ish) + crop/scale + ASS subtitr
    -> MP4 va rasm (thumbnail).
      tm      - _TimeMap (pauzalar kesilgan bo'lsa); None = oddiy kesish
      quality - fast | high | max (standart CLIPS_QUALITY)
      crop    - _plan_crop natijasi (single/split, cx); None = markaz
      vinfo   - probe_video_info(src) (bo'lmasa o'zi aniqlaydi)
    Natija: chiqish davomiyligi (soniya).
    """
    global _nvenc_ok
    ff = _ffmpeg_exe()
    w, h = _output_size(aspect)
    cs, ce = float(clip["start"]), float(clip["end"])
    span = ce - cs
    if tm is None:
        tm = _TimeMap.identity(span)
    quality = quality if quality in CLIP_QUALITY_PRESETS else CLIPS_QUALITY_DEFAULT
    if has_video and vinfo is None:
        vinfo = probe_video_info(src)
    fps = _pick_output_fps(vinfo, has_video)
    sub = f"subtitles='{_ass_path_for_filter(ass_path)}'"

    keep = tm.keep
    graph = []
    if len(keep) == 1:
        # Bitta bo'lak: kirishda aniq kesamiz (tez), filtrda trim shart emas
        ss, to = cs + keep[0][0], cs + keep[0][1]
        src_in = ["-ss", f"{ss:.3f}", "-to", f"{to:.3f}", "-i", src]
        n_parts = 1
    else:
        src_in = ["-ss", f"{cs:.3f}", "-to", f"{ce:.3f}", "-i", src]
        n_parts = len(keep)

    if has_video:
        inputs = src_in
        if n_parts == 1:
            vsrc, asrc = "[0:v]", "[0:a]"
        else:
            for i, (a, b) in enumerate(keep):
                graph.append(f"[0:v]trim=start={a:.3f}:end={b:.3f},setpts=PTS-STARTPTS[v{i}]")
                graph.append(f"[0:a]atrim=start={a:.3f}:end={b:.3f},asetpts=PTS-STARTPTS[a{i}]")
            graph.append("".join(f"[v{i}][a{i}]" for i in range(n_parts)) + f"concat=n={n_parts}:v=1:a=1[vc][ac]")
            vsrc, asrc = "[vc]", "[ac]"
        graph.append(f"{vsrc}{_crop_scale_chain(aspect, vinfo, crop)},{sub}[vout]")
        graph.append(f"{asrc}{CLIP_LOUDNORM}[aout]")
        tail = []
    else:
        # Audio-only manba: gradient fon (0-kirish) + audio (1-kirish)
        inputs = ["-f", "lavfi", "-i", _background_source(w, h, fps, tm.total)] + src_in
        if n_parts == 1:
            asrc = "[1:a]"
        else:
            for i, (a, b) in enumerate(keep):
                graph.append(f"[1:a]atrim=start={a:.3f}:end={b:.3f},asetpts=PTS-STARTPTS[a{i}]")
            graph.append("".join(f"[a{i}]" for i in range(n_parts)) + f"concat=n={n_parts}:v=0:a=1[ac]")
            asrc = "[ac]"
        graph.append(f"[0:v]{sub}[vout]")
        graph.append(f"{asrc}{CLIP_LOUDNORM}[aout]")
        tail = ["-shortest"]

    def _cmd(use_nvenc):
        return ([ff, "-y", "-hide_banner", "-loglevel", "error"] + inputs
                + ["-filter_complex", ";".join(graph), "-map", "[vout]", "-map", "[aout]"]
                + _video_codec_args(quality, fps, use_nvenc) + CLIP_AUDIO_ARGS + tail + [out_mp4])

    use_nvenc = _nvenc_available()
    try:
        _run(_cmd(use_nvenc), timeout=7200)
    except RuntimeError:
        if not use_nvenc:
            raise
        # NVENC o'rtada ishlamay qolsa (drayver/xotira) — CPU bilan qayta
        _nvenc_ok = False
        print("[klip] NVENC kodlash xato berdi — libx264 (CPU) bilan qayta urinilmoqda.")
        _run(_cmd(False), timeout=7200)

    try:
        out_dur = probe_duration(out_mp4)
    except Exception:
        out_dur = tm.total

    # Thumbnail: klip boshidan 1 soniya keyingi kadr (chiqish o'lchamida, yuqori sifat)
    t = min(1.0, max(0.0, out_dur / 2))
    _run([ff, "-y", "-hide_banner", "-loglevel", "error", "-ss", f"{t:.3f}", "-i", out_mp4,
          "-frames:v", "1", "-vf", f"scale={w}:{h}:flags=lanczos", "-q:v", "2", thumb_jpg], timeout=120)
    return out_dur


# ---------- butun oqim ----------
def _auto_clip_count(segments, total):
    """clip_count=0 (AUTO): har ~8 daqiqa nutqqa 1 klip, 2..8 oralig'ida."""
    speech = sum(max(0.0, s["end"] - s["start"]) for s in segments) if segments else 0.0
    if speech <= 0:
        speech = total or 0.0
    return max(2, min(8, int(round(speech / 480.0))))


def _render_one_clip(job_id, job_dir, src, has_video, vinfo, clip, words, callouts, params, i, n, env=None):
    """
    Bitta klipni to'liq tayyorlaydi: pauza rejasi -> smart crop -> ASS -> ffmpeg.
    Pauza kesish ishlamasa oddiy kesishga qaytadi. Natija: status uchun lug'at.
    """
    aspect = params["aspect"]
    pw, ph = _output_size(aspect)
    name = f"klip_{i}"
    ass_path = os.path.join(job_dir, name + ".ass")
    out_mp4 = os.path.join(job_dir, name + ".mp4")
    thumb = os.path.join(job_dir, name + ".jpg")
    span = float(clip["end"]) - float(clip["start"])
    base_p = 55 + (i - 1) * 40 // n
    step_p = max(1, 40 // (3 * n))

    # a) pauzalarni kesish rejasi
    tm = _TimeMap.identity(span)
    if params.get("remove_pauses", True):
        tm = _plan_pause_removal(clip, words, params.get("pause_threshold", 0.9), params.get("pause_keep", 0.25), env=env)

    # b) smart crop (faqat video manba, 9:16 / 1:1)
    crop = None
    if has_video and aspect in ("9:16", "1:1") and (params.get("smart_crop", True) or params.get("layout") == "split"):
        _set_clip_stage(job_id, f"Klip {i}/{n}: kadrda yuzlar qidirilmoqda", base_p)
        crop = _plan_crop(src, clip, params, job_dir, job_id)
        _check_cancel(job_id)

    # c) ASS + ffmpeg (pauza kesish xato bersa — oddiy kesish bilan qayta)
    _set_clip_stage(job_id, f"Klip {i}/{n} montaj qilinmoqda", base_p + step_p)
    try:
        build_ass(ass_path, clip, words, callouts, pw, ph, with_subs=params["subtitles"], tm=tm, audio_only=not has_video)
        out_dur = render_clip(src, has_video, clip, out_mp4, thumb, ass_path, aspect,
                              tm=tm, quality=params.get("quality"), crop=crop, vinfo=vinfo)
    except Exception as e:
        if tm.is_identity:
            raise
        _add_clip_warning(job_id, f"Klip {i}: pauzalarni kesish ishlamadi, oddiy kesish qilindi ({str(e)[-160:].strip()})")
        tm = _TimeMap.identity(span)
        build_ass(ass_path, clip, words, callouts, pw, ph, with_subs=params["subtitles"], tm=tm, audio_only=not has_video)
        out_dur = render_clip(src, has_video, clip, out_mp4, thumb, ass_path, aspect,
                              tm=tm, quality=params.get("quality"), crop=crop, vinfo=vinfo)

    return {
        "index": i,
        "filename": name + ".mp4",
        "title": clip.get("title", ""),
        "hook": clip.get("hook", ""),
        "start": clip["start"],
        "end": clip["end"],
        "duration": round(float(out_dur), 2),                 # CHIQISH davomiyligi (pauzalar kesilgan)
        "source_duration": round(span, 2),
        "removed_pause_seconds": round(tm.removed, 2),
        "layout": (crop or {}).get("layout", "single"),
        "url": f"/clips/file/{job_id}/{name}.mp4",
        "thumbnail_url": f"/clips/file/{job_id}/{name}.jpg",
        "reason": clip.get("reason", ""),
    }


def run_clips_job(job_id, params):
    job_dir = os.path.join(CLIPS_DIR, job_id)
    try:
        os.makedirs(job_dir, exist_ok=True)
        _cleanup_old_clip_jobs()

        # 1) Yuklab olish
        _set_clip_stage(job_id, "Yuklab olinmoqda", 2)
        src = download_source(params["source_url"], job_dir, job_id)
        _check_cancel(job_id)

        # 2) Audio + davomiylik
        _set_clip_stage(job_id, "Audio ajratilmoqda", 11)
        total = probe_duration(src)
        has_video = probe_has_video(src)
        vinfo = probe_video_info(src) if has_video else None
        if total < 15:
            raise RuntimeError("Yozuv juda qisqa (15 soniyadan kam) — klip kesish ma'nosiz.")
        wav = os.path.join(job_dir, "audio.wav")
        extract_audio(src, wav)
        with JOBS_LOCK:
            JOBS[job_id]["duration"] = round(total, 2)
        _check_cancel(job_id)

        # 3) Transkripsiya
        _set_clip_stage(job_id, "Matnga aylantirilmoqda (whisper)", 15)
        segments, words, language = transcribe_audio(wav, params["language"], job_id, total)
        preview = " ".join(s["text"] for s in segments)[:600]
        with JOBS_LOCK:
            JOBS[job_id]["transcript_preview"] = preview
            JOBS[job_id]["language"] = language
        if not words:
            raise RuntimeError("Nutq aniqlanmadi. Audio sifati past yoki tilni qo'lda tanlab ko'ring.")
        _check_cancel(job_id)

        # Pauza kesish uchun audio balandlik konturi (ixtiyoriy — bo'lmasa so'z vaqtlari ishlatiladi)
        env = None
        if params.get("remove_pauses", True):
            try:
                env = _audio_envelope(wav)
            except Exception as e:
                print(f"[klip] Audio konturi olinmadi ({e}); pauzalar so'z vaqtlari bo'yicha kesiladi.")

        # 3b) Klip soni AUTO bo'lsa — nutq davomiyligiga qarab
        if int(params.get("clip_count") or 0) <= 0:
            params["clip_count"] = _auto_clip_count(segments, total)
            print(f"[klip] {job_id}: klip soni avtomatik tanlandi: {params['clip_count']}")
        with JOBS_LOCK:
            JOBS[job_id]["clip_count"] = params["clip_count"]

        # 4) Hook tanlash
        _set_clip_stage(job_id, "Eng kuchli lahzalar tanlanmoqda", 48)
        clips, callouts, picker = choose_clips(segments, words, params, total, language, job_id)
        with JOBS_LOCK:
            JOBS[job_id]["picker"] = picker
        _check_cancel(job_id)

        # 5) Montaj — bitta klip xato bersa, qolganlari davom etadi
        results = []
        n = len(clips)
        for i, clip in enumerate(clips, start=1):
            _check_cancel(job_id)
            try:
                item = _render_one_clip(job_id, job_dir, src, has_video, vinfo, clip, words, callouts, params, i, n, env=env)
            except ClipCancelled:
                raise
            except Exception as e:
                traceback.print_exc()
                _add_clip_warning(job_id, f"Klip {i} ({clip.get('title') or _fmt_mmss(clip['start'])}) montaj qilinmadi: {str(e)[-200:].strip()}")
                continue
            results.append(item)
            with JOBS_LOCK:
                JOBS[job_id]["clips"] = list(results)

        if not results:
            with JOBS_LOCK:
                first_warn = (JOBS[job_id].get("warnings") or ["noma'lum xato"])[0]
            raise RuntimeError(f"Hech bir klip montaj qilinmadi: {first_warn}")

        # Joy tejash: katta vaqtinchalik fayllarni o'chiramiz
        for tmp in (wav,):
            try:
                os.remove(tmp)
            except Exception:
                pass

        with JOBS_LOCK:
            JOBS[job_id].update(state="done", stage="Tayyor", progress=100, clips=results)
            warnings = list(JOBS[job_id].get("warnings") or [])
        print(f"[klip] {job_id}: {len(results)} ta klip tayyor ({picker}"
              f"{', ' + str(len(warnings)) + ' ogohlantirish' if warnings else ''}).")
        payload = {"requestId": job_id, "state": "done", "clips": results, "duration": round(total, 2)}
        if warnings:
            payload["warnings"] = warnings
        _send_clip_callback(params, payload)

    except ClipCancelled:
        with JOBS_LOCK:
            JOBS[job_id].update(state="error", stage="Bekor qilindi", message="Vazifa bekor qilindi.")
        shutil.rmtree(job_dir, ignore_errors=True)
    except Exception as e:
        traceback.print_exc()
        msg = str(e) or "Noma'lum xato"
        low = msg.lower()
        if "faster_whisper" in low and "no module" in low:
            msg = "faster-whisper o'rnatilmagan: pip install faster-whisper"
        elif "yt_dlp" in low and "no module" in low:
            msg = "yt-dlp o'rnatilmagan: pip install yt-dlp"
        elif "memory" in low or "allocate" in low:
            msg = "Xotira yetmadi. WHISPER_MODEL=base yoki tiny qilib ko'ring. " + msg[:200]
        print(f"[klip] XATO ({job_id}): {msg}")
        with JOBS_LOCK:
            JOBS[job_id].update(state="error", stage="Xato", message=msg[:800])
        _send_clip_callback(params, {"requestId": job_id, "state": "error", "message": msg[:800]})


# ============================================================
# 4-QISM: HTTP interfeys
# ============================================================
class SubmitBody(BaseModel):
    image: str
    token: str = ""


@app.get("/health")
def health():
    info = detect_device()
    tier = pick_tier(info)
    return {
        "ok": True,
        "device": info["name"],
        "backend": info["backend"],
        "vram_gb": info["vram_gb"],
        "tier": tier["name"],
        "frames": tier["frames"],
        "size": tier["size"],
        # Podkast -> klip imkoniyatlari (sayt /klip sahifasi shuni tekshiradi)
        "clips": {
            "ffmpeg": _ffmpeg_ok(),
            "whisper": _module_available("faster_whisper"),
            "yt_dlp": _module_available("yt_dlp"),
            "gemini": bool(GEMINI_API_KEY),
            "whisper_model": WHISPER_MODEL,
            "whisper_device": _whisper_device_used or WHISPER_DEVICE,
            "nvenc": _nvenc_available(),                 # NVIDIA bilan kodlash (GPU)
            "opencv": _opencv_available(),               # smart crop uchun yuz detektori
            "quality_default": CLIPS_QUALITY_DEFAULT,    # fast | high | max
            "max_source_mb": int(CLIPS_MAX_SOURCE_MB),
        },
    }


@app.post("/submit")
def submit(body: SubmitBody):
    if WORKER_TOKEN and body.token != WORKER_TOKEN:
        return {"error": "Ruxsat yo'q"}
    if not body.image:
        return {"error": "Rasm yuborilmadi"}

    job_id = uuid.uuid4().hex
    with JOBS_LOCK:
        JOBS[job_id] = {"state": "pending", "stage": "Navbatda"}

    threading.Thread(target=run_job, args=(job_id, body.image), daemon=True).start()
    return {"requestId": job_id}


@app.get("/status/{job_id}")
def status(job_id: str):
    with JOBS_LOCK:
        job = JOBS.get(job_id)
    if not job:
        return {"state": "error", "message": "Topilmadi"}
    if job["state"] == "done":
        return {"state": "done", "video": job["video"]}
    if job["state"] == "error":
        return {"state": "error", "message": job.get("message", "Xato")}
    return {"state": "pending", "message": job.get("stage", "")}


class ImageBody(BaseModel):
    prompt: str
    token: str = ""


@app.post("/image/submit")
def image_submit(body: ImageBody):
    if WORKER_TOKEN and body.token != WORKER_TOKEN:
        return {"error": "Ruxsat yo'q"}
    if not body.prompt.strip():
        return {"error": "Tavsif yuborilmadi"}

    job_id = uuid.uuid4().hex
    with JOBS_LOCK:
        JOBS[job_id] = {"state": "pending", "stage": "Navbatda"}
    threading.Thread(target=run_image_job, args=(job_id, body.prompt), daemon=True).start()
    return {"requestId": job_id}


@app.get("/image/status/{job_id}")
def image_status(job_id: str):
    with JOBS_LOCK:
        job = JOBS.get(job_id)
    if not job:
        return {"state": "error", "message": "Topilmadi"}
    if job["state"] == "done":
        return {"state": "done", "image": job.get("image", "")}
    if job["state"] == "error":
        return {"state": "error", "message": job.get("message", "Xato")}
    return {"state": "pending", "message": job.get("stage", "")}


# ---------- Podkast -> klip endpointlari ----------
class SubmitBodyToken(BaseModel):
    token: str = ""


class ClipsBody(BaseModel):
    token: str = ""
    source_url: str                       # to'g'ridan-to'g'ri fayl (Vercel Blob) yoki YouTube havolasi
    max_clip_seconds: int = 120           # 15..180
    clip_count: int = 3                   # 1..8; 0 = AUTO (har ~8 daqiqa nutqqa 1 klip, 2..8)
    aspect: str = "9:16"                  # "9:16" | "16:9" | "1:1"
    subtitles: bool = True
    language: str = "auto"                # "uz" | "ru" | "en" | "auto"
    brand_terms: List[str] = Field(default_factory=list)   # ekranda alohida ko'rsatiladigan brend/pul iboralari
    instructions: str = ""                # Gemini'ga yetkaziladigan erkin istaklar
    callback_url: str = ""                # ixtiyoriy: tugagach shu manzilga POST (Telegram /klip uchun)
    callback_token: str = ""              # callback'da X-Worker-Token sarlavhasi
    # --- sifat va montaj ---
    quality: str = ""                     # "fast" | "high" | "max" (bo'sh = CLIPS_QUALITY, standart high)
    remove_pauses: bool = True            # so'zlar orasidagi uzun sukutlarni kesish (jump-cut)
    pause_threshold: float = 0.9          # shundan uzun sukut (soniya) kesiladi
    pause_keep: float = 0.25              # kesilgan sukutdan shuncha qoldiriladi (soniya)
    smart_crop: bool = True               # 9:16 / 1:1 da kadrni yuzga qarab markazlash (OpenCV)
    layout: str = "auto"                  # "auto" | "single" | "split" (ikki so'zlovchi — ekran ikkiga)


@app.post("/clips/submit")
def clips_submit(body: ClipsBody):
    if WORKER_TOKEN and body.token != WORKER_TOKEN:
        return {"error": "Ruxsat yo'q"}
    url = (body.source_url or "").strip()
    if not url.lower().startswith(("http://", "https://")):
        return {"error": "Manba havolasi noto'g'ri (http/https bo'lishi kerak)"}
    if not _ffmpeg_ok():
        return {"error": "ffmpeg topilmadi: pip install imageio-ffmpeg"}
    if not _module_available("faster_whisper"):
        return {"error": "faster-whisper o'rnatilmagan: pip install faster-whisper"}

    aspect = body.aspect if body.aspect in ("9:16", "16:9", "1:1") else "9:16"
    quality = (body.quality or "").strip().lower()
    if quality not in CLIP_QUALITY_PRESETS:
        quality = CLIPS_QUALITY_DEFAULT
    layout = (body.layout or "auto").strip().lower()
    if layout not in ("auto", "single", "split"):
        layout = "auto"
    try:
        pause_threshold = max(0.3, min(5.0, float(body.pause_threshold)))
    except Exception:
        pause_threshold = 0.9
    try:
        pause_keep = max(0.05, min(1.0, float(body.pause_keep)))
    except Exception:
        pause_keep = 0.25
    pause_keep = min(pause_keep, pause_threshold - 0.1)
    try:
        clip_count = int(body.clip_count)       # 0 = AUTO (nutq davomiyligiga qarab)
    except Exception:
        clip_count = 3
    params = {
        "source_url": url,
        "max_clip_seconds": max(15, min(180, int(body.max_clip_seconds or 120))),
        "clip_count": max(0, min(8, clip_count)),
        "aspect": aspect,
        "subtitles": bool(body.subtitles),
        "language": (body.language or "auto").strip().lower()[:8] or "auto",
        "brand_terms": [str(t).strip()[:40] for t in (body.brand_terms or []) if str(t).strip()][:30],
        "instructions": (body.instructions or "").strip()[:2000],
        "callback_url": (body.callback_url or "").strip()[:500],
        "callback_token": (body.callback_token or "")[:200],
        "quality": quality,
        "remove_pauses": bool(body.remove_pauses),
        "pause_threshold": round(pause_threshold, 3),
        "pause_keep": round(pause_keep, 3),
        "smart_crop": bool(body.smart_crop),
        "layout": layout,
    }

    job_id = uuid.uuid4().hex
    with JOBS_LOCK:
        JOBS[job_id] = {"kind": "clips", "state": "pending", "stage": "Navbatda", "progress": 0,
                        "created": time.time(), "params": params}
    threading.Thread(target=run_clips_job, args=(job_id, params), daemon=True).start()
    return {"requestId": job_id}


@app.get("/clips/status/{job_id}")
def clips_status(job_id: str):
    with JOBS_LOCK:
        job = JOBS.get(job_id)
        job = dict(job) if job else None
    if not job or job.get("kind") != "clips":
        return {"state": "error", "stage": "Xato", "progress": 0, "message": "Topilmadi"}
    out = {
        "state": job["state"],
        "stage": job.get("stage", ""),
        "progress": job.get("progress", 0),
    }
    if job.get("duration") is not None:
        out["duration"] = job["duration"]
    if job.get("transcript_preview"):
        out["transcript_preview"] = job["transcript_preview"]
    if job.get("language"):
        out["language"] = job["language"]
    if job.get("picker"):
        out["picker"] = job["picker"]
    if job.get("clip_count"):
        out["clip_count"] = job["clip_count"]
    if job.get("warnings"):
        out["warnings"] = list(job["warnings"])
    if job["state"] == "error":
        out["message"] = job.get("message", "Xato")
    if job.get("clips"):
        out["clips"] = job["clips"]
    return out


_SAFE_CLIP_FILE = re.compile(r"^klip_\d{1,2}\.(mp4|jpg)$")
_SAFE_JOB_ID = re.compile(r"^[0-9a-f]{32}$")


@app.get("/clips/file/{job_id}/{filename}")
def clips_file(job_id: str, filename: str):
    # Yo'l bo'ylab chiqib ketishdan himoya: faqat 'klip_N.mp4' / 'klip_N.jpg' va hex job_id
    if not _SAFE_JOB_ID.match(job_id) or not _SAFE_CLIP_FILE.match(filename):
        raise HTTPException(status_code=404, detail="Topilmadi")
    job_dir = os.path.realpath(os.path.join(CLIPS_DIR, job_id))
    path = os.path.realpath(os.path.join(job_dir, filename))
    if not path.startswith(os.path.realpath(CLIPS_DIR) + os.sep) or not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="Fayl topilmadi")
    media = "video/mp4" if filename.endswith(".mp4") else "image/jpeg"
    # FileResponse Range so'rovlarini qo'llaydi (brauzerda oldinga/orqaga surish ishlaydi)
    return FileResponse(path, media_type=media, filename=filename,
                        content_disposition_type="inline",
                        headers={"Accept-Ranges": "bytes", "Cache-Control": "private, max-age=3600"})


@app.post("/clips/cancel/{job_id}")
def clips_cancel(job_id: str, body: Optional[SubmitBodyToken] = None):
    if WORKER_TOKEN and (body is None or body.token != WORKER_TOKEN):
        return {"error": "Ruxsat yo'q"}
    with JOBS_LOCK:
        job = JOBS.get(job_id)
        if not job or job.get("kind") != "clips":
            return {"ok": False, "message": "Topilmadi"}
        if job["state"] != "pending":
            return {"ok": False, "message": "Vazifa allaqachon tugagan"}
        job["cancel"] = True
        job["stage"] = "Bekor qilinmoqda"
    return {"ok": True}


if __name__ == "__main__":
    import uvicorn

    info = detect_device()
    tier = pick_tier(info)
    print("=" * 60)
    print(f"  Uskuna : {info['name']}  ({info['backend']})")
    print(f"  Daraja : {tier['name']}  —  {tier['frames']} kadr, {tier['size']}px, {tier['steps']} qadam")
    if info["backend"] == "cpu":
        print("  OGOHLANTIRISH: protsessorda ishlaydi — bitta video 1-6 SOAT olishi mumkin.")
    elif info["vram_gb"] < 8:
        print("  OGOHLANTIRISH: video xotira kam — xato chiqsa, avtomatik CPU'ga o'tadi.")
    print(f"  Klip   : ffmpeg={'bor' if _ffmpeg_ok() else 'YO‘Q'}, "
          f"whisper={'bor' if _module_available('faster_whisper') else 'YO‘Q'} ({WHISPER_MODEL}), "
          f"yt-dlp={'bor' if _module_available('yt_dlp') else 'yo‘q'}, "
          f"gemini={'bor' if GEMINI_API_KEY else 'yo‘q (oddiy tanlov)'}")
    print(f"  Klip sifati: {CLIPS_QUALITY_DEFAULT}, "
          f"NVENC={'bor (GPU kodlash)' if _nvenc_available() else 'yo‘q (libx264, CPU)'}, "
          f"OpenCV={'bor (smart crop)' if _opencv_available() else 'yo‘q (markazdan kesiladi)'}")
    print(f"  Klip papkasi: {CLIPS_DIR}")
    print("=" * 60)

    uvicorn.run(app, host="0.0.0.0", port=8188)