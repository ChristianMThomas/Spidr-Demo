import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Trash2, Send, Loader2 } from 'lucide-react';
import { integrations } from '@/api/apiClient';
import { toast } from 'sonner';

/**
 * VoiceRecorder — records a short audio clip via MediaRecorder, uploads it,
 * and hands the resulting attachment back to the caller via onRecorded.
 *
 * The attachment shape matches the file-attachment shape used elsewhere:
 *   { name, url, type: 'audio/...', duration }
 * so the message renderer can detect audio attachments and show a player.
 *
 * Renders as a single mic button when idle. While recording it shows a live
 * timer + stop button. After stopping it shows a preview with send / discard.
 */
export default function VoiceRecorder({ onRecorded, disabled }) {
  const [state, setState] = useState('idle'); // idle | recording | preview | uploading
  const [seconds, setSeconds] = useState(0);
  const [blobUrl, setBlobUrl] = useState(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const blobRef = useRef(null);

  useEffect(() => () => {
    // Cleanup on unmount: stop tracks + timer + revoke object URL.
    clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    if (blobUrl) URL.revokeObjectURL(blobUrl);
  }, [blobUrl]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      // Prefer compact opus in webm; fall back to default if unsupported.
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : (MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '');
      const mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' });
        blobRef.current = blob;
        const url = URL.createObjectURL(blob);
        setBlobUrl(url);
        setState('preview');
        streamRef.current?.getTracks().forEach(t => t.stop());
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setSeconds(0);
      setState('recording');
      timerRef.current = setInterval(() => setSeconds(s => {
        // Hard cap at 5 minutes to keep uploads sane.
        if (s >= 300) { stopRecording(); return s; }
        return s + 1;
      }), 1000);
    } catch (err) {
      toast.error('Microphone access denied');
    }
  };

  const stopRecording = () => {
    clearInterval(timerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const discard = () => {
    clearInterval(timerRef.current);
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    blobRef.current = null;
    setBlobUrl(null);
    setSeconds(0);
    setState('idle');
  };

  const sendRecording = async () => {
    if (!blobRef.current) return;
    setState('uploading');
    try {
      // Derive a sensible file extension from the blob's mime type so the
      // uploaded URL ends in a recognizable audio extension (the server
      // renames to <uuid><ext>, so the extension is the only surviving signal
      // that this is audio). webm/ogg/mp4/wav all map cleanly; default to webm.
      const mime = blobRef.current.type || 'audio/webm';
      const ext =
        mime.includes('webm') ? 'webm' :
        mime.includes('ogg')  ? 'ogg'  :
        mime.includes('mp4')  ? 'm4a'  :
        mime.includes('mpeg') ? 'mp3'  :
        mime.includes('wav')  ? 'wav'  : 'webm';
      const file = new File([blobRef.current], `voice-message-${Date.now()}.${ext}`, { type: mime });
      const { url } = await integrations.Core.UploadFile({ file });
      if (!url) throw new Error('no url');
      onRecorded({ name: 'Voice message', url, type: mime, duration: seconds, isVoice: true });
      discard();
    } catch (err) {
      toast.error('Could not send voice message');
      setState('preview');
    }
  };

  const mmss = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

  if (state === 'idle') {
    return (
      <button
        type="button"
        onClick={startRecording}
        disabled={disabled}
        className="w-9 h-9 rounded-lg flex items-center justify-center text-zinc-400 hover:text-red-400 hover:bg-white/5 transition-colors disabled:opacity-40"
        title="Record voice message"
      >
        <Mic className="w-5 h-5" />
      </button>
    );
  }

  if (state === 'recording') {
    return (
      <div className="flex items-center gap-2 bg-red-600/15 border border-red-500/40 rounded-lg px-2.5 py-1.5">
        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        <span className="text-red-300 text-xs font-mono">{mmss}</span>
        <button type="button" onClick={stopRecording} className="text-white hover:text-red-300" title="Stop">
          <Square className="w-4 h-4 fill-current" />
        </button>
      </div>
    );
  }

  // preview / uploading
  return (
    <div className="flex items-center gap-2 bg-zinc-800 border border-white/10 rounded-lg px-2.5 py-1.5">
      {blobUrl && <audio src={blobUrl} controls className="h-8 max-w-[160px]" />}
      <span className="text-zinc-400 text-xs font-mono">{mmss}</span>
      <button type="button" onClick={discard} className="text-zinc-400 hover:text-red-400" title="Discard">
        <Trash2 className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={sendRecording}
        disabled={state === 'uploading'}
        className="w-7 h-7 rounded-lg bg-red-600 hover:bg-red-500 text-white flex items-center justify-center disabled:opacity-50"
        title="Send voice message"
      >
        {state === 'uploading' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}
