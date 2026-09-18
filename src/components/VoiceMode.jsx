'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { X, Mic, MicOff, Loader2 } from 'lucide-react';

// ============================================================
// JONLI (ONLAYN) SUHBAT — to'liq ekranli ovozli rejim.
//
// Ishlash tartibi (halqa):
//   eshitish -> jimlik sezildi -> serverga yuborish -> javobni eshittirish
//   -> yana eshitish...
//
// Foydalanuvchi hech qanday tugma bosmaydi: gapirib bo'lgach, bir lahza
// jim turishi kifoya — ilova o'zi tushunadi. Kayfiyatni (xursand, siqilgan,
// charchagan) server tomonda ovoz ohangidan aniqlanadi va javob ham,
// ovoz ohangi ham shunga moslashadi.
// ============================================================

// Jimlikni aniqlash sozlamalari.
const SILENCE_LEVEL = 0.012; // shundan past bo'lsa "jim" deb hisoblanadi
const SILENCE_MS = 1200; // gapirgandan keyin shuncha jimlik = gap tugadi
const MIN_SPEECH_MS = 400; // bundan qisqa tovush — tasodifiy shovqin
const MAX_TURN_MS = 30000; // bitta gap eng ko'pi bilan 30 soniya

const STATUS_TEXT = {
    listening: 'Eshityapman...',
    thinking: "O'ylayapman...",
    speaking: 'Javob beryapman',
    paused: 'Mikrofon oʻchiq',
    error: 'Xatolik',
};

export default function VoiceMode( { open, onClose, onExchange, onPlanUpdate } ) {
    const [ status, setStatus ] = useState( 'listening' );
    const [ level, setLevel ] = useState( 0 ); // 0..1 — to'pchaning "nafas olishi"
    const [ transcript, setTranscript ] = useState( '' );
    const [ reply, setReply ] = useState( '' );
    const [ error, setError ] = useState( '' );
    const [ muted, setMuted ] = useState( false );

    const streamRef = useRef( null );
    const audioCtxRef = useRef( null );
    const analyserRef = useRef( null );
    const recorderRef = useRef( null );
    const chunksRef = useRef( [] );
    const rafRef = useRef( null );
    const audioRef = useRef( null );
    const historyRef = useRef( [] );
    const mutedRef = useRef( false );
    const closedRef = useRef( false );
    const sendingRef = useRef( false );

    useEffect( () => {
        mutedRef.current = muted;
    }, [ muted ] );

    // --- Serverga yuborish va javobni eshittirish ---
    const sendTurn = useCallback(
        async ( blob ) => {
            if ( sendingRef.current ) return;
            sendingRef.current = true;
            setStatus( 'thinking' );

            try {
                const base64 = await new Promise( ( resolve, reject ) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve( String( reader.result ).split( ',' )[ 1 ] );
                    reader.onerror = reject;
                    reader.readAsDataURL( blob );
                } );

                const res = await fetch( '/api/voice', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify( {
                        audio: base64,
                        mimeType: blob.type || 'audio/webm',
                        history: historyRef.current.slice( -8 ),
                    } ),
                } );
                const data = await res.json().catch( () => null );
                if ( !res.ok ) throw new Error( data?.error || 'Xatolik' );

                if ( closedRef.current ) return;

                // Jimlik/shovqin — hech narsa aytilmagan, yana eshitishga qaytamiz.
                if ( data?.empty ) {
                    sendingRef.current = false;
                    startListening();
                    return;
                }

                if ( data.plan ) onPlanUpdate?.( data.plan );
                setTranscript( data.transcript || '' );
                setReply( data.reply || '' );
                historyRef.current.push( { role: 'user', text: data.transcript || '' } );
                historyRef.current.push( { role: 'assistant', text: data.reply || '' } );
                onExchange?.( data.transcript || '', data.reply || '' );

                if ( data.audio ) {
                    setStatus( 'speaking' );
                    const audio = new Audio( `data:audio/mpeg;base64,${ data.audio }` );
                    audioRef.current = audio;
                    audio.onended = () => {
                        sendingRef.current = false;
                        if ( !closedRef.current ) startListening();
                    };
                    audio.onerror = () => {
                        sendingRef.current = false;
                        if ( !closedRef.current ) startListening();
                    };
                    await audio.play().catch( () => {
                        sendingRef.current = false;
                        if ( !closedRef.current ) startListening();
                    } );
                } else {
                    sendingRef.current = false;
                    startListening();
                }
            } catch ( err ) {
                if ( closedRef.current ) return;
                setError( err.message || 'Xatolik' );
                setStatus( 'error' );
                sendingRef.current = false;
            }
        },
        // startListening pastroqda e'lon qilingan, lekin ref orqali barqaror ishlaydi
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [ onExchange, onPlanUpdate ]
    );

    // --- Eshitishni boshlash (jimlikni o'zi sezadi) ---
    const startListening = useCallback( () => {
        const stream = streamRef.current;
        const analyser = analyserRef.current;
        if ( !stream || !analyser || closedRef.current ) return;
        if ( mutedRef.current ) {
            setStatus( 'paused' );
            return;
        }

        let recorder;
        try {
            const mimeType = MediaRecorder.isTypeSupported( 'audio/webm' ) ? 'audio/webm' : '';
            recorder = mimeType ? new MediaRecorder( stream, { mimeType } ) : new MediaRecorder( stream );
        } catch {
            setError( "Mikrofonni o'qib bo'lmadi." );
            setStatus( 'error' );
            return;
        }

        chunksRef.current = [];
        recorderRef.current = recorder;
        recorder.ondataavailable = ( e ) => {
            if ( e.data.size > 0 ) chunksRef.current.push( e.data );
        };
        recorder.onstop = () => {
            cancelAnimationFrame( rafRef.current );
            setLevel( 0 );
            const blob = new Blob( chunksRef.current, { type: recorder.mimeType || 'audio/webm' } );
            chunksRef.current = [];
            if ( closedRef.current ) return;
            if ( blob.size < 2000 ) {
                // juda qisqa — shunchaki yana eshitamiz
                startListening();
                return;
            }
            sendTurn( blob );
        };

        recorder.start();
        setStatus( 'listening' );
        setError( '' );

        // Ovoz darajasini kuzatib, gapirish tugaganini aniqlaymiz.
        const data = new Uint8Array( analyser.fftSize );
        const startedAt = Date.now();
        let speechStartedAt = 0;
        let lastLoudAt = 0;

        const tick = () => {
            if ( closedRef.current || recorder.state !== 'recording' ) return;
            analyser.getByteTimeDomainData( data );

            let sum = 0;
            for ( let i = 0; i < data.length; i++ ) {
                const v = ( data[ i ] - 128 ) / 128;
                sum += v * v;
            }
            const rms = Math.sqrt( sum / data.length );
            setLevel( Math.min( 1, rms * 6 ) );

            const now = Date.now();
            if ( rms > SILENCE_LEVEL ) {
                if ( !speechStartedAt ) speechStartedAt = now;
                lastLoudAt = now;
            }

            const spoke = speechStartedAt && now - speechStartedAt > MIN_SPEECH_MS;
            const silentLongEnough = lastLoudAt && now - lastLoudAt > SILENCE_MS;

            if ( ( spoke && silentLongEnough ) || now - startedAt > MAX_TURN_MS ) {
                try {
                    recorder.stop();
                } catch { }
                return;
            }

            rafRef.current = requestAnimationFrame( tick );
        };
        rafRef.current = requestAnimationFrame( tick );
    }, [ sendTurn ] );

    // --- Ochilganda mikrofonni yoqish, yopilganda hammasini to'xtatish ---
    useEffect( () => {
        if ( !open ) return;
        closedRef.current = false;
        sendingRef.current = false;
        historyRef.current = [];
        setTranscript( '' );
        setReply( '' );
        setError( '' );
        setMuted( false );

        let cancelled = false;

        ( async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia( { audio: true } );
                if ( cancelled ) {
                    stream.getTracks().forEach( ( t ) => t.stop() );
                    return;
                }
                streamRef.current = stream;
                const ctx = new ( window.AudioContext || window.webkitAudioContext )();
                audioCtxRef.current = ctx;
                const source = ctx.createMediaStreamSource( stream );
                const analyser = ctx.createAnalyser();
                analyser.fftSize = 1024;
                source.connect( analyser );
                analyserRef.current = analyser;
                startListening();
            } catch {
                setError( "Mikrofonga ruxsat berilmadi. Brauzer sozlamalaridan ruxsat bering." );
                setStatus( 'error' );
            }
        } )();

        return () => {
            cancelled = true;
            closedRef.current = true;
            cancelAnimationFrame( rafRef.current );
            try {
                if ( recorderRef.current?.state === 'recording' ) recorderRef.current.stop();
            } catch { }
            audioRef.current?.pause();
            audioRef.current = null;
            streamRef.current?.getTracks().forEach( ( t ) => t.stop() );
            streamRef.current = null;
            audioCtxRef.current?.close().catch( () => { } );
            audioCtxRef.current = null;
            analyserRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ open ] );

    function toggleMute() {
        const next = !muted;
        setMuted( next );
        mutedRef.current = next;
        if ( next ) {
            cancelAnimationFrame( rafRef.current );
            try {
                if ( recorderRef.current?.state === 'recording' ) recorderRef.current.stop();
            } catch { }
            chunksRef.current = [];
            audioRef.current?.pause();
            setLevel( 0 );
            setStatus( 'paused' );
        } else if ( !sendingRef.current ) {
            startListening();
        }
    }

    if ( !open ) return null;

    const scale = status === 'listening' ? 1 + level * 0.35 : status === 'speaking' ? 1.12 : 1;

    return (
        <div className="fixed inset-0 z-[60] flex flex-col bg-[var(--tg-bg)]">
            {/* Yuqori qator */ }
            <div className="flex items-center justify-between px-4 py-4 sm:px-6">
                <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-[#2F9E96] shadow-[0_0_0_4px_rgba(47,158,150,0.18)]" />
                    <p className="text-sm font-semibold text-[var(--tg-text-1)]">Jonli suhbat</p>
                </div>
                <button
                    onClick={ onClose }
                    aria-label="Yopish"
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--tg-border)] text-[var(--tg-text-2)] transition hover:bg-[var(--tg-hover)]"
                >
                    <X size={ 17 } />
                </button>
            </div>

            {/* O'rtadagi to'pcha */ }
            <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
                <div className="relative flex h-44 w-44 items-center justify-center">
                    <span
                        className="absolute inset-0 rounded-full opacity-30 blur-2xl transition-transform duration-100"
                        style={ {
                            background: 'linear-gradient(135deg, #E4A93B, #2F9E96)',
                            transform: `scale(${ scale })`,
                        } }
                    />
                    <div
                        className={ `relative h-32 w-32 rounded-full transition-transform duration-100 ${ status === 'speaking' ? 'animate-pulse' : ''
                            }` }
                        style={ {
                            background: 'linear-gradient(135deg, #E4A93B, #2F9E96)',
                            transform: `scale(${ scale })`,
                        } }
                    />
                    { status === 'thinking' && (
                        <Loader2 size={ 28 } className="absolute animate-spin text-[#0A0A0B]" />
                    ) }
                </div>

                <p className="mt-8 text-sm font-medium text-[var(--tg-text-2)]">
                    { error || STATUS_TEXT[ status ] || '' }
                </p>

                { transcript && (
                    <p className="mt-6 max-w-lg text-sm text-[var(--tg-text-3)]">“{ transcript }”</p>
                ) }
                { reply && (
                    <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-[var(--tg-text-1)]">{ reply }</p>
                ) }

                { status === 'error' && (
                    <button
                        onClick={ () => {
                            setError( '' );
                            startListening();
                        } }
                        className="mt-6 rounded-full border border-[var(--tg-border)] px-4 py-2 text-xs text-[var(--tg-text-2)] transition hover:bg-[var(--tg-hover)]"
                    >
                        Qayta urinish
                    </button>
                ) }
            </div>

            {/* Pastki tugmalar */ }
            <div className="flex items-center justify-center gap-4 px-6 pb-10">
                <button
                    onClick={ toggleMute }
                    title={ muted ? 'Mikrofonni yoqish' : "Mikrofonni o'chirish" }
                    className={ `flex h-14 w-14 items-center justify-center rounded-full border transition ${ muted
                            ? 'border-red-500/40 bg-red-500/10 text-red-400'
                            : 'border-[var(--tg-border)] text-[var(--tg-text-2)] hover:bg-[var(--tg-hover)]'
                        }` }
                >
                    { muted ? <MicOff size={ 20 } /> : <Mic size={ 20 } /> }
                </button>
                <button
                    onClick={ onClose }
                    title="Suhbatni tugatish"
                    className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--tg-hover-strong)] text-[var(--tg-text-1)] transition hover:opacity-90"
                >
                    <X size={ 20 } />
                </button>
            </div>

            <p className="pb-6 text-center text-[11px] text-[var(--tg-text-4)]">
                Gapiring — bir lahza jim turganingizda javob beraman. Oʻzbekcha, ruscha yoki inglizcha gapirsangiz ham tushunaman.
            </p>
        </div>
    );
}
