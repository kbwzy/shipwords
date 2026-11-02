import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react';
import { poseCropStyle, type PoseCrop } from './pose-sheet';
import './pose-generator-preview.css';

export type PoseChoice = PoseCrop & { name: string; prompt: string };
export type LibraryPose = PoseChoice & { id: string; category: string; series: string };
type LocalJob = { id: string; status: string; error?: string; resultUrl?: string };
type PoseApiMode = 'local' | 'remote';
const localApi = 'http://127.0.0.1:6045';
export const isPoseJobPending = (status: string) => status !== 'succeeded' && status !== 'failed';
export const shouldPollPoseJob = (status: string) => isPoseJobPending(status) && status !== 'input_required' && status !== 'needs_attention';
export function poseResultUrl(mode: PoseApiMode, id: string, resultUrl?: string): string | null {
  if (!resultUrl) return null;
  const expected = mode === 'remote' ? `/api/pose/jobs/${encodeURIComponent(id)}/result` : `/result/${encodeURIComponent(id)}`;
  return resultUrl === expected ? (mode === 'remote' ? expected : `${localApi}${expected}`) : null;
}
export function createPoseApi(mode: PoseApiMode, fetcher: typeof fetch = fetch) {
  const base = mode === 'remote' ? '/api/pose' : localApi;
  const options = mode === 'remote' ? { credentials: 'same-origin' as const } : {};
  return {
    startSession: () => mode === 'remote' ? fetcher(`${base}/session`, { ...options, method: 'POST', cache: 'no-store' }) : Promise.resolve(new Response(null, { status: 204 })),
    create: (body: FormData, key: string) => fetcher(`${base}/${mode === 'remote' ? 'jobs' : 'generate'}`, { ...options, method: 'POST', headers: { 'Idempotency-Key': key }, body }),
    recover: (key: string) => fetcher(`${base}/${mode === 'remote' ? 'recover' : 'jobs/recover'}`, { ...options, headers: { 'Idempotency-Key': key }, ...(mode === 'remote' ? { cache: 'no-store' as const } : {}) }),
    getJob: (id: string, signal?: AbortSignal) => fetcher(`${base}/jobs/${encodeURIComponent(id)}`, { ...options, ...(mode === 'remote' ? { cache: 'no-store' as const } : {}), signal }),
  };
}
export function retryPoseInput(api: ReturnType<typeof createPoseApi>, key: string, original: FormData | null, reselected: FormData) {
  return api.create(original ?? reselected, key);
}
function taskStorageKey(mode: PoseApiMode) { return mode === 'local' ? 'aipose:local-task' : 'aipose:remote-task'; }
function storeLocalTask(mode: PoseApiMode, value: { id?: string; key?: string } | null): boolean {
  try { if (value) sessionStorage.setItem(taskStorageKey(mode), JSON.stringify(value)); else sessionStorage.removeItem(taskStorageKey(mode)); return true; } catch { return false; }
}
export function parseSavedPoseTask(raw: string | null): { id?: string; key?: string } | null {
  try {
    const value = JSON.parse(raw ?? 'null') as { id?: unknown; key?: unknown } | null;
    const id = value && typeof value.id === 'string' && /^[0-9a-f-]{36}$/.test(value.id) ? value.id : undefined;
    const key = value && typeof value.key === 'string' && /^[A-Za-z0-9_-]{8,128}$/.test(value.key) ? value.key : undefined;
    if (id || key) return { ...(id ? { id } : {}), ...(key ? { key } : {}) };
  } catch {}
  return null;
}
function readLocalTask(mode: PoseApiMode) {
  try { return parseSavedPoseTask(sessionStorage.getItem(taskStorageKey(mode))); } catch { return null; }
}

/** Remote API integration is opt-in; the default remains the local test service. */
export function PoseGeneratorPreview({ choice, library, onChoose, apiMode: requestedApiMode = 'local' }: { choice: LibraryPose | null; library: LibraryPose[]; onChoose: (pose: LibraryPose | null) => void; apiMode?: PoseApiMode }) {
  const id = useId();
  // A task must never move between services while this workspace is mounted.
  const [apiMode] = useState(requestedApiMode);
  const [mode, setMode] = useState<'image' | 'video'>('image');
  const [videoSource, setVideoSource] = useState<'text' | 'pose' | 'image'>('text');
  const [brief, setBrief] = useState('');
  const [motionBrief, setMotionBrief] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryQuery, setLibraryQuery] = useState('');
  const [librarySeries, setLibrarySeries] = useState('All');
  const [libraryCategory, setLibraryCategory] = useState('All');
  const [localReady, setLocalReady] = useState(false);
  const [consent, setConsent] = useState(false);
  const [job, setJob] = useState<LocalJob | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [jobError, setJobError] = useState('');
  const [pendingRecovery, setPendingRecovery] = useState(false);
  const pendingRequest = useRef<{ key: string; form?: FormData } | null>(null);
  const submitLock = useRef(false);
  const recoveryStarted = useRef(false);
  const libraryDialog = useRef<HTMLDialogElement>(null);
  const api = createPoseApi(apiMode);
  const ready = apiMode === 'remote' || localReady;

  useEffect(() => { if (choice && job && !isPoseJobPending(job.status)) { setJob(null); pendingRequest.current = null; storeLocalTask(apiMode, null); } }, [choice]);
  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo); }, [photo]);
  useEffect(() => {
    if (apiMode !== 'local' || !['localhost', '127.0.0.1'].includes(window.location.hostname)) return;
    const controller = new AbortController();
    void fetch(`${localApi}/health`, { signal: controller.signal }).then(async (response) => response.ok ? await response.json() as { available?: boolean } : null).then((body) => setLocalReady(body?.available === true)).catch(() => {});
    return () => controller.abort();
  }, [apiMode]);
  useEffect(() => {
    if (!ready || recoveryStarted.current) return;
    recoveryStarted.current = true;
    const saved = readLocalTask(apiMode);
    if (saved?.key) pendingRequest.current = { key: saved.key };
    if (saved?.id) setJob({ id: saved.id, status: 'queued' });
    else if (saved?.key) { setPendingRecovery(true); void recoverRequest(saved.key); }
  }, [ready, apiMode]);
  useEffect(() => {
    if (!job || !shouldPollPoseJob(job.status)) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void api.getJob(job.id, controller.signal).then(async (response) => {
        if (response.status === 404) throw new Error('The task is unavailable or this session no longer has access. The previous request may still be processing.');
        if (!response.ok) throw new Error('Could not check the task; checking the same task again.');
        return response.json() as Promise<LocalJob>;
      }).then((next) => { if (!next.id || next.id !== job.id || !next.status) throw new Error('Invalid task response.'); setJobError(''); setPendingRecovery(false); setJob(next); }).catch((error: unknown) => { if (!controller.signal.aborted) { setJobError(error instanceof Error ? error.message : 'Connection interrupted; checking the same task again.'); setJob((current) => current ? { ...current } : null); } });
    }, 2500);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [job]);
  useEffect(() => {
    const dialog = libraryDialog.current;
    if (!dialog) return;
    if (libraryOpen && !dialog.open) dialog.showModal();
    else if (!libraryOpen && dialog.open) dialog.close();
  }, [libraryOpen]);

  const librarySeriesList = ['All', ...new Set(library.map((pose) => pose.series))];
  const libraryCategories = ['All', ...new Set(library.map((pose) => pose.category))];
  const matches = library.filter((pose) => (librarySeries === 'All' || pose.series === librarySeries) && (libraryCategory === 'All' || pose.category === libraryCategory) && `${pose.name} ${pose.category} ${pose.series}`.toLowerCase().includes(libraryQuery.trim().toLowerCase()));
  const resultUrl = job ? poseResultUrl(apiMode, job.id, job.resultUrl) : null;
  const hasResult = job?.status === 'succeeded' && !!resultUrl;
  const selectedPose = choice;
  const hasPose = !!selectedPose;
  const inputRequired = job?.status === 'input_required';
  const retryKey = pendingRequest.current?.key ?? readLocalTask(apiMode)?.key;
  const originalForm = inputRequired ? pendingRequest.current?.form : undefined;
  const blockedByJob = !!job && isPoseJobPending(job.status) && !inputRequired;

  async function recoverRequest(key: string) {
    setRecovering(true);
    try {
      const response = await api.recover(key);
      const data = await response.json() as Partial<LocalJob> & { error?: string };
      if (!response.ok || !data.id || !data.status) {
        setJobError(response.status === 404 ? 'The request was not found. It may still be in transit; check again before starting a new request.' : response.status === 410 ? 'The local service no longer has this task. Inspect the provider for its status and cost before starting another.' : data.error || 'Could not check the previous request. Try again.');
        return;
      }
      storeLocalTask(apiMode, { id: data.id, key }); setPendingRecovery(false); setJobError('');
      setJob({ id: data.id, status: data.status === 'input_required' || data.status === 'needs_attention' ? data.status : 'queued' });
    } catch { setJobError('Could not check the previous request. Reconnect and check it before starting another.'); }
    finally { setRecovering(false); }
  }

  function clearFinishedJob() {
    if (job && !isPoseJobPending(job.status)) { setJob(null); pendingRequest.current = null; storeLocalTask(apiMode, null); }
    setJobError('');
  }

  function dismissRecovery() {
    if (!window.confirm('Only start a new request after checking that the previous request is not still running or chargeable. Continue?')) return;
    pendingRequest.current = null; storeLocalTask(apiMode, null); setPendingRecovery(false); setJobError('');
  }

  function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) {
      setError('Choose a JPEG, PNG or WebP image under 10 MB.');
      return;
    }
    setError('');
    clearFinishedJob();
    setPhotoFile(file);
    setPhoto(URL.createObjectURL(file));
  }


  async function selectedPoseBlob(selected: PoseChoice): Promise<Blob> {
    const image = new Image();
    image.src = selected.source;
    try { await image.decode(); } catch { throw new Error('Could not load the pose reference. Please choose it again.'); }
    const canvas = document.createElement('canvas');
    canvas.width = selected.width; canvas.height = selected.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not prepare the pose reference.');
    context.drawImage(image, selected.x, selected.y, selected.width, selected.height, 0, 0, selected.width, selected.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('Could not prepare the pose reference.');
    return blob;
  }

  async function generateLocal() {
    if (submitLock.current || submitting || !ready || mode !== 'image') return;
    submitLock.current = true;
    try {
      if (pendingRecovery) { const key = pendingRequest.current?.key ?? readLocalTask(apiMode)?.key; if (key) await recoverRequest(key); return; }
      const retrying = job?.status === 'input_required';
      const keyForRetry = retrying ? pendingRequest.current?.key ?? readLocalTask(apiMode)?.key : undefined;
      const savedForm = retrying ? pendingRequest.current?.form : undefined;
      if (retrying && !keyForRetry) { setJobError('The original request key is unavailable. Contact support with the task ID.'); return; }
      if (!savedForm && (!consent || (!choice && !brief.trim()))) { setJobError('Choose a pose or describe the pose you want, and confirm consent.'); return; }
      if (!retrying) pendingRequest.current = null;
      setJobError(''); setSubmitting(true);
      try {
        const form = new FormData();
        if (!savedForm) {
          form.set('consent', 'yes'); form.set('prompt', brief.trim());
          if (photoFile) form.set('photo', photoFile);
          if (choice) form.set('pose', await selectedPoseBlob(choice), 'pose-reference.png');
        }
        let key = keyForRetry;
        if (!retrying) {
          const session = await api.startSession();
          if (!session.ok) throw new Error('Could not start a generation session. Please try again later.');
          key = crypto.randomUUID();
          if (!storeLocalTask(apiMode, { key })) throw new Error('Browser session storage is unavailable; generation cannot be resumed safely.');
        }
        if (!key) throw new Error('The original request key is unavailable.');
        pendingRequest.current = { key, form: savedForm ?? form };
        const response = retrying ? await retryPoseInput(api, key, savedForm ?? null, form) : await api.create(form, key);
        const data = await response.json() as { id?: string; status?: string; error?: string };
        if (!response.ok || !data.id || !data.status || (retrying && data.id !== job.id)) {
          if (retrying && response.status === 409 && !savedForm) pendingRequest.current = { key };
          if (!retrying && !response.ok && [400, 401, 402, 403, 413, 415, 422, 429].includes(response.status)) { pendingRequest.current = null; storeLocalTask(apiMode, null); setPendingRecovery(false); }
          if (retrying && !response.ok && response.status >= 400 && response.status < 500) {
            setJobError(response.status === 409 ? 'The input does not match the original request. Reselect the exact same files, pose and instructions, or contact support with the task ID.' : data.error || 'Could not resend the input. Please check it and try again.');
            return;
          }
          throw new Error(data.error || 'Could not start generation.');
        }
        storeLocalTask(apiMode, { id: data.id, key }); setPendingRecovery(false);
        setJob({ id: data.id, status: data.status === 'input_required' || data.status === 'needs_attention' ? data.status : 'queued' });
      } catch (error) {
        if (retrying && job) {
          setJob({ id: job.id, status: 'queued' });
          setJobError('The resend status is uncertain. Checking the same task again.');
        } else if (pendingRequest.current) { setPendingRecovery(true); setJobError(`${error instanceof Error ? error.message : 'Connection interrupted.'} The request status is uncertain. Check the previous request before starting another.`); }
        else setJobError(error instanceof Error ? error.message : 'Could not start generation.');
      }
      finally { setSubmitting(false); }
    } finally { submitLock.current = false; }
  }

  function stopTracking() {
    if (!window.confirm('The previous task may still be running or chargeable. Stop tracking it and allow a new request?')) return;
    setJob(null); pendingRequest.current = null; storeLocalTask(apiMode, null); setJobError('');
  }

  async function downloadResult(resultUrl: string) {
    try {
      const resultAddress = job && poseResultUrl(apiMode, job.id, resultUrl);
      if (!resultAddress) throw new Error('Invalid result URL.');
      const response = await fetch(resultAddress, apiMode === 'remote' ? { cache: 'no-store', credentials: 'same-origin' } : undefined);
      if (!response.ok) throw new Error('Download unavailable.');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `pose-result.${blob.type === 'image/jpeg' ? 'jpg' : blob.type === 'image/webp' ? 'webp' : 'png'}`;
      link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setJobError('Could not download the result.'); }
  }

  return <section className="pg-preview" id="create" aria-labelledby={`${id}-title`}>
    <div className="pg-preview__intro">
      <p className="pg-preview__eyebrow"><span aria-hidden="true" /> {apiMode === 'remote' ? 'IMAGE GENERATION' : 'CREATIVE WORKSPACE PREVIEW'}</p>
      <h2 id={`${id}-title`}>Start with <em>your idea.</em></h2>
      <p>{apiMode === 'remote' ? 'Generate a new pose from your photo and a reference pose, or create a fresh figure from a pose alone. Video is not available yet.' : localReady ? 'Choose a pose and optionally add a photo to try image generation locally. Video is not available yet.' : 'Choose a pose, and optionally add a photo to edit. Image and video generation are not available yet.'}</p>
    </div>
    <div className="pg-preview__workspace">
      <fieldset className="pg-preview__form" disabled={submitting || recovering || blockedByJob}>
        <div className="pg-preview__form-heading"><span>YOUR POSE STUDIO</span><span>01 / 02</span></div>
        {inputRequired && <p role="status">{retryKey ? originalForm ? 'The original input is ready to resend with the same request. You can also reselect it below.' : 'Reselect the exact same photo, pose and instructions used for this request, then resend. Changed input will be rejected.' : 'The original request key is unavailable. Contact support with the task ID shown in the result panel.'}</p>}
        {inputRequired && originalForm && retryKey && <button className="pg-preview__remove" type="button" onClick={() => { pendingRequest.current = { key: retryKey }; setJobError(''); setJob((current) => current ? { ...current } : null); }}>Reselect original input</button>}
        <fieldset className="pg-preview__inputs" disabled={pendingRecovery || (inputRequired && !!originalForm)}>
        <fieldset className="pg-preview__modes"><legend>Choose a format</legend><div className="pg-preview__mode-options">
          {(['image', 'video'] as const).map((option) => <label className="pg-preview__mode" key={option}>
            <input type="radio" name={`${id}-mode`} value={option} aria-label={option === 'image' ? 'Image' : 'Video'} checked={mode === option} disabled={pendingRecovery || inputRequired} onChange={() => { setMode(option); clearFinishedJob(); }} />
            <span>{option === 'image' ? 'Image' : 'Video'}</span>
          </label>)}
        </div></fieldset>
        {mode === 'image' && <div className="pg-preview__image-setup">
          <div className="pg-preview__step-heading"><span>01</span><strong>Your photo <small>optional</small></strong></div>
          <input className="pg-preview__file" id={`${id}-photo`} type="file" accept="image/jpeg,image/png,image/webp" onChange={choosePhoto} />
          <label className="pg-preview__file-label" htmlFor={`${id}-photo`}><strong>{photo ? 'Change your photo' : 'Choose your photo'}</strong><span>{photo ? 'Photo selected' : 'Add a photo to edit a specific person; skip it for a new person.'}</span></label>
          {photo && <button className="pg-preview__remove" type="button" onClick={() => { setPhoto(null); setPhotoFile(null); setError(''); clearFinishedJob(); }}>Remove photo</button>}
          {error && <p className="pg-preview__error" role="alert">{error}</p>}
          <div className="pg-preview__step-heading"><span>02</span><strong>Choose a pose</strong></div>
          <button className="pg-preview__library-button" type="button" onClick={() => setLibraryOpen(true)}><span><strong>{choice ? choice.name : 'Explore the pose library'}</strong><small>{choice ? 'Change your selected pose' : `${library.length} references to choose from`}</small></span><span aria-hidden="true">↗</span></button>
          {selectedPose && <button className="pg-preview__remove" type="button" onClick={() => { onChoose(null); clearFinishedJob(); }}>Remove selected pose</button>}
          <p className="pg-preview__privacy">JPG, PNG or WebP · Up to 10 MB · {ready ? 'Files stay in your browser until you generate.' : 'Local preview only.'}</p>
        </div>}
        {mode === 'video' && <fieldset className="pg-preview__sources"><legend>Start your video with</legend>
          {([
            ['text', 'Text', 'Describe a scene and movement'],
            ['pose', 'Pose reference', 'Start from a gallery pose'],
            ['image', 'An image', 'Animate a photo or saved image'],
          ] as const).map(([value, label, hint]) => <label className="pg-preview__source" key={value}><input type="radio" name={`${id}-video-source`} value={value} checked={videoSource === value} onChange={() => setVideoSource(value)} /><span><strong>{label}</strong><small>{hint}</small></span></label>)}
        </fieldset>}
        {mode === 'image' ? <details className="pg-preview__optional"><summary>Add instructions <span>optional</span></summary><label className="sr-only" htmlFor={`${id}-brief`}>Pose instructions</label><textarea id={`${id}-brief`} value={brief} maxLength={2000} onChange={(event) => { setBrief(event.target.value); clearFinishedJob(); }} placeholder={photo ? 'For example: keep the outfit and background...' : 'Describe the person, clothing and scene you have in mind...'} rows={3} /></details> : <><label className="pg-preview__label" htmlFor={`${id}-motion`}>Describe the motion <span>YOUR BRIEF</span></label><textarea id={`${id}-motion`} value={motionBrief} maxLength={2000} onChange={(event) => setMotionBrief(event.target.value)} placeholder="Describe the subject, movement and camera..." rows={5} /><p className="pg-preview__hint">{videoSource === 'pose' ? 'Describe how the selected pose should move. Pose guidance depends on the model.' : videoSource === 'image' ? 'Describe how the image should move. It is intended as the starting frame.' : 'Describe the subject, action and camera movement.'}</p></>}
        {mode === 'video' && videoSource === 'pose' && <button className="pg-preview__library-button" type="button" onClick={() => setLibraryOpen(true)}>{choice ? `Change pose: ${choice.name} ↗` : 'Choose a pose from the library ↗'}</button>}
        {mode === 'video' && videoSource === 'image' && <p className="pg-preview__image-hint">Choose an image in the reference panel. You can select a saved generated image from your device. A creations library is not available yet.</p>}
        {mode === 'image' && ready && <label className="pg-preview__consent"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /> <span>I am 18 or older, everyone pictured is an adult, and I have permission to use these images. I agree to send them to the generation provider. See our <a href="/privacy" target="_blank" rel="noreferrer">privacy policy</a>.</span></label>}
        </fieldset>
        <button className="pg-preview__generate" type="button" disabled={mode !== 'image' || !ready || (inputRequired && !retryKey) || (!pendingRecovery && !originalForm && (!consent || (!hasPose && !brief.trim()))) || submitting || recovering || blockedByJob} onClick={() => void generateLocal()} aria-describedby={`${id}-unavailable`}>{submitting || recovering ? 'Checking…' : pendingRecovery ? 'Check previous request' : inputRequired ? 'Resend original input' : blockedByJob ? 'Generating…' : `Generate ${mode}`} <span aria-hidden="true">↗</span></button>
        <p className="pg-preview__unavailable" id={`${id}-unavailable`}>{mode === 'video' ? 'Video generation is not available yet.' : apiMode === 'remote' ? 'Free tier: up to 3 requests per visitor each UTC day, subject to daily availability. Paid credit packs unlock more. Model: openai/gpt-image-2.5-sunburst.' : localReady ? 'Local test: images are sent to Yir using openai/gpt-image-2.5-sunburst when you generate. Maximum provider cost $0.30 per attempt.' : 'Generation is not available here. Your selections are a local preview.'}</p>
        {mode === 'image' && ready && !pendingRecovery && !originalForm && !hasPose && !brief.trim() && <p className="pg-preview__hint">Choose a pose or add instructions to continue.</p>}
        {pendingRecovery && <button className="pg-preview__remove pg-preview__recovery-dismiss" type="button" onClick={dismissRecovery}>Start a new request after checking</button>}
        {jobError && <p className="pg-preview__error" role="alert">{jobError}</p>}
      </fieldset>
      <div className="pg-preview__sample">
        <div className="pg-preview__sample-heading"><span>YOUR PREVIEW</span><span>02 / 02</span></div>
        {job && isPoseJobPending(job.status) && jobError && <button className="pg-preview__remove pg-preview__recovery-dismiss" type="button" onClick={stopTracking}>Stop tracking this request</button>}
        {mode === 'image' ? <div className="pg-preview__visual">
          <div className="pg-preview__visual-copy"><span>{hasResult ? 'YOUR RESULT' : photo ? 'YOUR PHOTO' : hasPose ? 'POSE REFERENCE' : 'EXAMPLE POSE EDIT'}</span><h3>{hasResult ? 'Your image is ready.' : photo ? 'Your photo is ready.' : hasPose ? 'Your pose is ready.' : 'See a pose change.'}</h3><p>{hasResult ? 'Review your result and download it below. See our privacy policy for processing details.' : photo && hasPose ? 'Ready to create with your selected pose.' : photo ? 'Choose a pose or add instructions to continue.' : hasPose ? 'Use this pose to create a new person, or add your photo.' : 'An AI-generated figure changed from standing to seated.'}</p>{!hasResult && !photo && !hasPose && library[0] && <div className="pg-preview__example-before"><div role="img" aria-label="Example original: a woman standing" style={poseCropStyle(library[0])} /><span>Example original</span></div>}{!hasResult && <div className="pg-preview__visual-pose"><span>YOUR POSE</span><strong>{selectedPose?.name ?? 'Choose a pose'}</strong></div>}</div>
          <div className="pg-preview__visual-card"><div className="pg-preview__visual-image">{hasResult ? <img src={resultUrl!} crossOrigin="anonymous" alt="Your generated pose image" /> : photo ? <img src={photo} alt="Your photo" onError={() => { setPhoto(null); setPhotoFile(null); setError('This image could not be opened. Choose another file.'); }} /> : selectedPose ? <div role="img" aria-label={`Selected pose: ${selectedPose.name}`} style={poseCropStyle(selectedPose)} /> : <img src="/pose-edit-example.png" alt="Example AI pose edit: a woman seated on a chair" />}</div><strong>{hasResult ? 'Generated image' : photo ? 'Your photo' : hasPose ? 'Selected pose reference' : 'Example pose edit · AI-generated'}</strong><small>{hasResult ? 'Review the pose and details before using it.' : photo ? 'Not a generated result' : hasPose ? 'Reference only · not a generated result' : 'Example generated separately for illustration'}</small></div>
          {photo && !hasResult && selectedPose && <div className="pg-preview__pose-thumb" aria-label="Selected pose preview"><div role="img" aria-label={`Selected pose: ${selectedPose.name}`} style={poseCropStyle(selectedPose)} /></div>}
        </div> : <><div className="pg-preview__guide"><div><span>HOW IT WORKS</span><h3>Imagine a little motion.</h3><p>Describe a scene or use an image as your starting point.</p></div></div>
        <div className="pg-preview__references">
          {videoSource === 'pose' && <div><span className="pg-preview__reference-label">POSE REFERENCE</span><div className="pg-preview__reference-frame">
            {choice ? <div className="pg-preview__chosen-pose" role="img" aria-label={`Selected pose: ${choice.name}`} style={poseCropStyle(choice)} /> : <p>Choose a pose from the gallery.</p>}
          </div><strong>{choice?.name ?? 'No pose selected'}</strong></div>}
          {videoSource === 'image' && <div><span className="pg-preview__reference-label">STARTING IMAGE</span><div className="pg-preview__reference-frame">
            {photo ? <img src={photo} alt="Your locally selected reference" onError={() => { setPhoto(null); setPhotoFile(null); setError('This image could not be opened. Choose another file.'); }} /> : <p>Your image preview appears here.</p>}
          </div>{mode === 'video' && <><input id={`${id}-photo`} type="file" accept="image/jpeg,image/png,image/webp" onChange={choosePhoto} /><label className="pg-preview__upload" htmlFor={`${id}-photo`}>{photo ? 'Change image' : 'Choose an image'}</label>{photo && <button className="pg-preview__remove" type="button" onClick={() => { setPhoto(null); setPhotoFile(null); setError(''); }}>Remove</button>}</>}</div>}
          {mode === 'video' && videoSource === 'text' && <div className="pg-preview__text-start"><span className="pg-preview__reference-label">TEXT TO VIDEO</span><p>Describe your idea on the left. No reference image is needed.</p></div>}
        </div>
        {mode === 'video' && videoSource === 'image' && <p className="pg-preview__privacy">JPEG, PNG or WebP, up to 10 MB. Your file stays in this browser and is not uploaded. Use an image you have permission to use.</p>}
        {mode === 'video' && videoSource === 'image' && error && <p className="pg-preview__error" role="alert">{error}</p>}
        </>}
        <div className="pg-preview__result" aria-live="polite"><strong>{inputRequired ? 'Input needed' : job?.status === 'needs_attention' ? 'Task needs attention' : job?.status === 'unknown' ? 'Checking your request…' : job && isPoseJobPending(job.status) ? 'Generating your image…' : hasResult ? 'Your image is ready' : job?.status === 'succeeded' ? 'Result unavailable' : job?.status === 'failed' ? 'Generation failed' : 'Your result'}</strong><p>{inputRequired ? 'Resend the original input to continue this task.' : job?.status === 'needs_attention' ? 'Please contact support later and provide this task ID. The task will not be retried automatically.' : job?.status === 'unknown' ? 'The task status is uncertain. We will keep checking the same request.' : job?.status === 'failed' ? job.error || 'Please try again later.' : hasResult ? 'Download your image or try another pose.' : job?.status === 'succeeded' ? 'The result could not be displayed. Please check again later.' : ready && mode === 'image' ? 'Your generated image will appear here.' : 'Generated images and videos will appear here once generation is available.'}</p>{(inputRequired || job?.status === 'needs_attention') && job && <p>Task ID: {job.id}</p>}{hasResult && job?.resultUrl && <button type="button" className="pg-preview__download" onClick={() => void downloadResult(job.resultUrl!)}>Download image ↓</button>}{job?.status === 'succeeded' && !hasResult && <button type="button" className="pg-preview__download" onClick={() => setJob({ id: job.id, status: 'queued' })}>Check result again</button>}{job?.status === 'needs_attention' && <button type="button" className="pg-preview__download" onClick={() => setJob({ id: job.id, status: 'queued' })}>Check status again</button>}</div>
      </div>
    </div>
    <dialog className="pg-library" ref={libraryDialog} aria-labelledby={`${id}-library-title`} onClose={() => setLibraryOpen(false)} onClick={(event) => { const rect = event.currentTarget.getBoundingClientRect(); if (event.target === event.currentTarget && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) setLibraryOpen(false); }}>
      <div className="pg-library__header"><div><p>THE POSE LIBRARY</p><h2 id={`${id}-library-title`}>Find your next pose.</h2><span>Choose a reference to bring into your studio.</span></div><button type="button" className="pg-library__close" onClick={() => setLibraryOpen(false)} aria-label="Close pose library">×</button></div>
      <label className="pg-library__search"><span className="sr-only">Search pose library</span><input type="search" placeholder="Search poses..." value={libraryQuery} onChange={(event) => setLibraryQuery(event.target.value)} /></label>
      <div className="pg-library__filters" aria-label="Filter pose series">{librarySeriesList.map((series) => <button type="button" key={series} aria-pressed={librarySeries === series} onClick={() => setLibrarySeries(series)}>{series}</button>)}</div>
      <div className="pg-library__filters" aria-label="Filter pose category">{libraryCategories.map((category) => <button type="button" key={category} aria-pressed={libraryCategory === category} onClick={() => setLibraryCategory(category)}>{category === 'All' ? 'All poses' : category}</button>)}</div>
      <p className="pg-library__count" aria-live="polite">{matches.length} {matches.length === 1 ? 'pose' : 'poses'}</p>
      {matches.length ? <div className="pg-library__grid">{matches.map((pose) => <button type="button" key={pose.id} className="pg-library__pose" aria-pressed={choice?.id === pose.id} onClick={() => { onChoose(pose); clearFinishedJob(); setLibraryOpen(false); }}><span className="pg-library__image"><span className="pg-library__sprite" style={poseCropStyle(pose)} /></span><strong>{pose.name}</strong><small>{pose.category}</small></button>)}</div> : <p className="pg-library__empty">No poses found. Try another search or filter.</p>}
    </dialog>
  </section>;
}
