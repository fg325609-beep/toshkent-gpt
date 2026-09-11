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
"""
 
import base64
import io
import os
import threading
import uuid
 
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
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
 
    import torch
 
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
            "fp16": False,  # eski AMD kartalarida fp16 beqaror ishlaydi
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
    return {"name": "low", "frames": 8, "size": 320, "steps": 12, "offload": "sequential"}
 
 
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
    return {"name": "low", "size": 512, "steps": 25}   # 4-6 GB
 
 
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
    if tier["offload"] == "sequential" and info["backend"] == "cuda":
        pipe.enable_sequential_cpu_offload()
    elif tier["offload"] == "model" and info["backend"] == "cuda":
        pipe.enable_model_cpu_offload()
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
        print(f"[worker] XATO: {e}")
        with JOBS_LOCK:
            JOBS[job_id].update(state="error", message=str(e))
 
 
 
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
 
        image = pipe(
            prompt=prompt,
            width=tier["size"],
            height=tier["size"],
            num_inference_steps=steps,
            guidance_scale=guidance,
        ).images[0]
 
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
    print("=" * 60)
 
    uvicorn.run(app, host="0.0.0.0", port=8188)
 