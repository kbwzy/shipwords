import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react';
import './garment-generator-preview.css';

/** A library tile the studio can use as a generation reference. Tiles are plain images, not sprite crops. */
export type LibraryItem = {
  id: string;
  name: string;
  /** Example instructions shown in the gallery and prefilled when the tile is picked. */
  prompt?: string;
  category: string;
  series: 'Garments' | 'Model poses';
  image: string;
};
type Source = { kind: 'file'; file: File; preview: string } | { kind: 'library'; item: LibraryItem } | null;
type LocalJob = { id: string; status: string; error?: string; resultUrl?: string };
const TASK_STORAGE_KEY = 'onmodel:garment-task';
export const isGarmentJobPending = (status: string) => status !== 'succeeded' && status !== 'failed';
export const shouldPollGarmentJob = (status: string) => isGarmentJobPending(status) && status !== 'input_required' && status !== 'needs_attention';
export function garmentResultUrl(id: string, resultUrl?: string): string | null {
  const expected = `/api/garment/jobs/${encodeURIComponent(id)}/result`;
  return resultUrl === expected ? expected : null;
}
export function createGarmentApi(fetcher: typeof fetch = fetch) {
  const options = { credentials: 'same-origin' as const };
  return {
    startSession: () => fetcher('/api/garment/session', { ...options, method: 'POST', cache: 'no-store' }),
    create: (body: FormData, key: string) => fetcher('/api/garment/jobs', { ...options, method: 'POST', headers: { 'Idempotency-Key': key }, body }),
    recover: (key: string) => fetcher('/api/garment/recover', { ...options, headers: { 'Idempotency-Key': key }, cache: 'no-store' }),
    getJob: (id: string, signal?: AbortSignal) => fetcher(`/api/garment/jobs/${encodeURIComponent(id)}`, { ...options, cache: 'no-store', signal }),
  };
}
export function retryGarmentInput(api: ReturnType<typeof createGarmentApi>, key: string, original: FormData | null, reselected: FormData) {
  return api.create(original ?? reselected, key);
}
function storeTask(value: { id?: string; key?: string } | null): boolean {
  try { if (value) sessionStorage.setItem(TASK_STORAGE_KEY, JSON.stringify(value)); else sessionStorage.removeItem(TASK_STORAGE_KEY); return true; } catch { return false; }
}
export function parseSavedGarmentTask(raw: string | null): { id?: string; key?: string } | null {
  try {
    const value = JSON.parse(raw ?? 'null') as { id?: unknown; key?: unknown } | null;
    const id = value && typeof value.id === 'string' && /^[0-9a-f-]{36}$/.test(value.id) ? value.id : undefined;
    const key = value && typeof value.key === 'string' && /^[A-Za-z0-9_-]{8,128}$/.test(value.key) ? value.key : undefined;
    if (id || key) return { ...(id ? { id } : {}), ...(key ? { key } : {}) };
  } catch {}
  return null;
}
function readTask() {
  try { return parseSavedGarmentTask(sessionStorage.getItem(TASK_STORAGE_KEY)); } catch { return null; }
}

/** The garment studio: a garment reference (upload or library tile) plus optional model reference. */
export function GarmentGeneratorPreview({ library, garment, model, onPick }: {
  library: LibraryItem[];
  garment: LibraryItem | null;
  model: LibraryItem | null;
  onPick: (item: LibraryItem | null, slot: 'garment' | 'model') => void;
}) {
  const id = useId();
  const [brief, setBrief] = useState('');
  const [garmentSource, setGarmentSource] = useState<Source>(null);
  const [modelSource, setModelSource] = useState<Source>(null);
  const [error, setError] = useState('');
  const [librarySlot, setLibrarySlot] = useState<'garment' | 'model' | null>(null);
  const [libraryQuery, setLibraryQuery] = useState('');
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
  const api = createGarmentApi();

  useEffect(() => { if ((garmentSource || modelSource) && job && !isGarmentJobPending(job.status)) { setJob(null); pendingRequest.current = null; storeTask(null); } }, [garmentSource, modelSource]);
  useEffect(() => () => { for (const source of [garmentSource, modelSource]) if (source?.kind === 'file') URL.revokeObjectURL(source.preview); }, [garmentSource, modelSource]);
  useEffect(() => {
    if (recoveryStarted.current) return;
    recoveryStarted.current = true;
    const saved = readTask();
    if (saved?.key) pendingRequest.current = { key: saved.key };
    if (saved?.id) setJob({ id: saved.id, status: 'queued' });
    else if (saved?.key) { setPendingRecovery(true); void recoverRequest(saved.key); }
  }, []);
  useEffect(() => {
    if (!job || !shouldPollGarmentJob(job.status)) return;
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
    if (librarySlot && !dialog.open) dialog.showModal();
    else if (!librarySlot && dialog.open) dialog.close();
  }, [librarySlot]);

  const matches = library.filter((item) => (librarySlot === null || item.series === (librarySlot === 'garment' ? 'Garments' : 'Model poses')) && `${item.name} ${item.category}`.toLowerCase().includes(libraryQuery.trim().toLowerCase()));
  const resultUrl = job ? garmentResultUrl(job.id, job.resultUrl) : null;
  const hasResult = job?.status === 'succeeded' && !!resultUrl;
  const hasGarment = !!garmentSource || !!garment;
  const inputRequired = job?.status === 'input_required';
  const retryKey = pendingRequest.current?.key ?? readTask()?.key;
  const originalForm = inputRequired ? pendingRequest.current?.form : undefined;
  const blockedByJob = !!job && isGarmentJobPending(job.status) && !inputRequired;
  const ready = true;

  async function recoverRequest(key: string) {
    setRecovering(true);
    try {
      const response = await api.recover(key);
      const data = await response.json() as Partial<LocalJob> & { error?: string };
      if (!response.ok || !data.id || !data.status) {
        setJobError(response.status === 404 ? 'The request was not found. It may still be in transit; check again before starting a new request.' : response.status === 410 ? 'The server no longer has this task. Inspect the provider for its status and cost before starting another.' : data.error || 'Could not check the previous request. Try again.');
        return;
      }
      storeTask({ id: data.id, key }); setPendingRecovery(false); setJobError('');
      setJob({ id: data.id, status: data.status === 'input_required' || data.status === 'needs_attention' ? data.status : 'queued' });
    } catch { setJobError('Could not check the previous request. Reconnect and check it before starting another.'); }
    finally { setRecovering(false); }
  }

  function clearFinishedJob() {
    if (job && !isGarmentJobPending(job.status)) { setJob(null); pendingRequest.current = null; storeTask(null); }
    setJobError('');
  }

  function dismissRecovery() {
    if (!window.confirm('Only start a new request after checking that the previous request is not still running or chargeable. Continue?')) return;
    pendingRequest.current = null; storeTask(null); setPendingRecovery(false); setJobError('');
  }

  function pickFile(slot: 'garment' | 'model') {
    return (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return;
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) {
        setError('Choose a JPEG, PNG or WebP image under 10 MB.');
        return;
      }
      setError('');
      clearFinishedJob();
      const source: Source = { kind: 'file', file, preview: URL.createObjectURL(file) };
      if (slot === 'garment') { onPick(null, 'garment'); setGarmentSource(source); }
      else { onPick(null, 'model'); setModelSource(source); }
    };
  }

  function pickLibrary(item: LibraryItem) {
    if (!librarySlot) return;
    clearFinishedJob();
    if (librarySlot === 'garment') {
      setGarmentSource({ kind: 'library', item });
      if (item.prompt && !brief.trim()) setBrief(item.prompt);
    } else setModelSource({ kind: 'library', item });
    onPick(item, librarySlot);
    setLibrarySlot(null);
  }

  async function libraryBlob(item: LibraryItem): Promise<Blob> {
    const response = await fetch(item.image, { cache: 'force-cache' });
    if (!response.ok) throw new Error('Could not load the reference. Please choose it again.');
    return response.blob();
  }

  async function generate() {
    if (submitLock.current || submitting) return;
    submitLock.current = true;
    try {
      if (pendingRecovery) { const key = pendingRequest.current?.key ?? readTask()?.key; if (key) await recoverRequest(key); return; }
      const retrying = job?.status === 'input_required';
      const keyForRetry = retrying ? pendingRequest.current?.key ?? readTask()?.key : undefined;
      const savedForm = retrying ? pendingRequest.current?.form : undefined;
      if (retrying && !keyForRetry) { setJobError('The original request key is unavailable. Contact support with the task ID.'); return; }
      if (!savedForm && (!consent || (!garmentSource && !garment && !brief.trim()))) { setJobError('Choose a garment or describe the shot, and confirm consent.'); return; }
      if (!retrying) pendingRequest.current = null;
      setJobError(''); setSubmitting(true);
      try {
        const form = new FormData();
        if (!savedForm) {
          form.set('consent', 'yes'); form.set('prompt', brief.trim());
          if (garmentSource?.kind === 'file') form.set('garment', garmentSource.file, garmentSource.file.name);
          else if (garmentSource?.kind === 'library') form.set('garment', await libraryBlob(garmentSource.item), 'garment-reference.jpg');
          else if (garment) form.set('garment', await libraryBlob(garment), 'garment-reference.jpg');
          if (modelSource?.kind === 'file') form.set('model', modelSource.file, modelSource.file.name);
          else if (modelSource?.kind === 'library') form.set('model', await libraryBlob(modelSource.item), 'model-reference.jpg');
          else if (model) form.set('model', await libraryBlob(model), 'model-reference.jpg');
        }
        let key = keyForRetry;
        if (!retrying) {
          const session = await api.startSession();
          if (!session.ok) throw new Error('Could not start a generation session. Please try again later.');
          key = crypto.randomUUID();
          if (!storeTask({ key })) throw new Error('Browser session storage is unavailable; generation cannot be resumed safely.');
        }
        if (!key) throw new Error('The original request key is unavailable.');
        pendingRequest.current = { key, form: savedForm ?? form };
        const response = retrying ? await retryGarmentInput(api, key, savedForm ?? null, form) : await api.create(form, key);
        const data = await response.json() as { id?: string; status?: string; error?: string };
        if (!response.ok || !data.id || !data.status || (retrying && data.id !== job?.id)) {
          if (retrying && response.status === 409 && !savedForm) pendingRequest.current = { key };
          if (!retrying && !response.ok && [400, 401, 402, 403, 413, 415, 422, 429].includes(response.status)) { pendingRequest.current = null; storeTask(null); setPendingRecovery(false); }
          if (retrying && !response.ok && response.status >= 400 && response.status < 500) {
            setJobError(response.status === 409 ? 'The input does not match the original request. Reselect the exact same files and instructions, or contact support with the task ID.' : data.error || 'Could not resend the input. Please check it and try again.');
            return;
          }
          throw new Error(data.error || 'Could not start generation.');
        }
        storeTask({ id: data.id, key }); setPendingRecovery(false);
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
    setJob(null); pendingRequest.current = null; storeTask(null); setJobError('');
  }

  async function downloadResult(address: string) {
    try {
      const resultAddress = job && garmentResultUrl(job.id, address);
      if (!resultAddress) throw new Error('Invalid result URL.');
      const response = await fetch(resultAddress, { cache: 'no-store', credentials: 'same-origin' });
      if (!response.ok) throw new Error('Download unavailable.');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `onmodel-result.${blob.type === 'image/jpeg' ? 'jpg' : blob.type === 'image/webp' ? 'webp' : 'png'}`;
      link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setJobError('Could not download the result.'); }
  }

  function SourceChip({ slot, source, picked, heading, hint }: { slot: 'garment' | 'model'; source: Source; picked: LibraryItem | null; heading: string; hint: string }) {
    const name = source?.kind === 'file' ? source.file.name : source?.kind === 'library' ? source.item.name : picked?.name;
    const image = source?.kind === 'file' ? source.preview : source?.kind === 'library' ? source.item.image : picked?.image;
    return <div className="pg-preview__step">
      <div className="pg-preview__step-heading"><span>{slot === 'garment' ? '01' : '02'}</span><strong>{heading}{slot === 'model' && <small>optional</small>}</strong></div>
      <input className="pg-preview__file" id={`${id}-${slot}`} type="file" accept="image/jpeg,image/png,image/webp" onChange={pickFile(slot)} />
      <div className="pg-preview__slot-actions">
        <label className="pg-preview__file-label" htmlFor={`${id}-${slot}`}><strong>{source?.kind === 'file' ? 'Change your photo' : `Upload a ${slot} photo`}</strong><span>{hint}</span></label>
        <button className="pg-preview__library-button" type="button" onClick={() => setLibrarySlot(slot)}><span><strong>{name ?? `Explore the ${slot} library`}</strong><small>{name ? 'Change the selected reference' : `${library.filter((entry) => entry.series === (slot === 'garment' ? 'Garments' : 'Model poses')).length} references to choose from`}</small></span><span aria-hidden="true">↗</span></button>
      </div>
      {image && <div className="pg-preview__slot-chip"><img src={image} alt="" /> <span>{name}</span><button className="pg-preview__remove" type="button" onClick={() => { if (slot === 'garment') { onPick(null, 'garment'); setGarmentSource(null); } else { onPick(null, 'model'); setModelSource(null); } setError(''); clearFinishedJob(); }}>Remove</button></div>}
    </div>;
  }

  return <section className="pg-preview" id="create" aria-labelledby={`${id}-title`}>
    <div className="pg-preview__intro">
      <p className="pg-preview__eyebrow"><span aria-hidden="true" /> ON-MODEL GENERATION</p>
      <h2 id={`${id}-title`}>Start with <em>your garment.</em></h2>
      <p>Upload a flat-lay product photo — or pick one from the library — choose an optional model reference, and get a catalog-ready on-model shot.</p>
    </div>
    <div className="pg-preview__workspace">
      <fieldset className="pg-preview__form" disabled={submitting || recovering || blockedByJob}>
        <div className="pg-preview__form-heading"><span>YOUR GARMENT STUDIO</span><span>01 / 02</span></div>
        {inputRequired && <p role="status">{retryKey ? originalForm ? 'The original input is ready to resend with the same request. You can also reselect it below.' : 'Reselect the exact same photos and instructions used for this request, then resend. Changed input will be rejected.' : 'The original request key is unavailable. Contact support with the task ID shown in the result panel.'}</p>}
        {inputRequired && originalForm && retryKey && <button className="pg-preview__remove" type="button" onClick={() => { pendingRequest.current = { key: retryKey }; setJobError(''); setJob((current) => current ? { ...current } : null); }}>Reselect original input</button>}
        <fieldset className="pg-preview__inputs" disabled={pendingRecovery || (inputRequired && !!originalForm)}>
          <SourceChip slot="garment" source={garmentSource} picked={garment} heading="Your garment" hint="A clean flat-lay or ghost-mannequin product photo works best." />
          <SourceChip slot="model" source={modelSource} picked={model} heading="Model reference" hint="Optional: a model photo for body type, skin tone and hair. Skip for a new model." />
          <details className="pg-preview__optional" open={!garmentSource && !garment}>
            <summary>Add instructions <span>{garmentSource || garment ? 'optional' : 'required without a garment'}</span></summary>
            <label className="sr-only" htmlFor={`${id}-brief`}>Shot instructions</label>
            <textarea id={`${id}-brief`} value={brief} maxLength={2000} onChange={(event) => { setBrief(event.target.value); clearFinishedJob(); }} placeholder="For example: full-body shot, hands in pockets, light grey studio background..." rows={3} />
          </details>
          <label className="pg-preview__consent"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /> <span>I am 18 or older, I own or have permission to use these images, and I agree to send them to the generation provider. See our <a href="/privacy" target="_blank" rel="noreferrer">privacy policy</a>.</span></label>
        </fieldset>
        <button className="pg-preview__generate" type="button" disabled={(inputRequired && !retryKey) || (!pendingRecovery && !originalForm && (!consent || (!hasGarment && !brief.trim()))) || submitting || recovering || blockedByJob} onClick={() => void generate()} aria-describedby={`${id}-unavailable`}>{submitting || recovering ? 'Checking…' : pendingRecovery ? 'Check previous request' : inputRequired ? 'Resend original input' : blockedByJob ? 'Generating…' : 'Generate on-model photo'} <span aria-hidden="true">↗</span></button>
        <p className="pg-preview__unavailable" id={`${id}-unavailable`}>Free tier: up to 3 requests per visitor each UTC day, subject to daily availability. Paid credit packs unlock more. Model: openai/gpt-image-2.5-sunburst.</p>
        {!pendingRecovery && !originalForm && !hasGarment && !brief.trim() && <p className="pg-preview__hint">Choose a garment or add instructions to continue.</p>}
        {pendingRecovery && <button className="pg-preview__remove pg-preview__recovery-dismiss" type="button" onClick={dismissRecovery}>Start a new request after checking</button>}
        {error && <p className="pg-preview__error" role="alert">{error}</p>}
        {jobError && <p className="pg-preview__error" role="alert">{jobError}</p>}
      </fieldset>
      <div className="pg-preview__sample">
        <div className="pg-preview__sample-heading"><span>YOUR PREVIEW</span><span>02 / 02</span></div>
        {job && isGarmentJobPending(job.status) && jobError && <button className="pg-preview__remove pg-preview__recovery-dismiss" type="button" onClick={stopTracking}>Stop tracking this request</button>}
        <div className="pg-preview__visual">
          <div className="pg-preview__visual-copy"><span>{hasResult ? 'YOUR RESULT' : hasGarment ? 'GARMENT REFERENCE' : 'EXAMPLE ON-MODEL EDIT'}</span><h3>{hasResult ? 'Your image is ready.' : hasGarment ? 'Your garment is set.' : 'See a garment come to life.'}</h3><p>{hasResult ? 'Review your result and download it below. See our privacy policy for processing details.' : hasGarment ? 'Ready to create your on-model photo.' : 'A flat-lay product photo turned into a model wearing the same garment.'}</p>{!hasResult && <div className="pg-preview__visual-garment"><span>YOUR GARMENT</span><strong>{garmentSource?.kind === 'file' ? garmentSource.file.name : garmentSource?.kind === 'library' ? garmentSource.item.name : garment?.name ?? (modelSource || model ? 'No garment selected' : 'Choose a garment')}</strong></div>}{!hasResult && (modelSource || model) && <div className="pg-preview__visual-garment"><span>MODEL REFERENCE</span><strong>{modelSource?.kind === 'file' ? modelSource.file.name : modelSource?.kind === 'library' ? modelSource.item.name : model?.name ?? ''}</strong></div>}</div>
          <div className="pg-preview__visual-card"><div className="pg-preview__visual-image">{hasResult ? <img src={resultUrl!} alt="Your generated on-model photo" /> : garmentSource?.kind === 'file' || garmentSource?.kind === 'library' ? <img src={garmentSource.kind === 'file' ? garmentSource.preview : garmentSource.item.image} alt="Your selected garment reference" /> : garment ? <img src={garment.image} alt="Selected garment reference" /> : <img src="/garment-edit-example.jpg" alt="Example AI on-model edit" />}</div><strong>{hasResult ? 'Generated image' : hasGarment ? 'Garment reference' : 'Example on-model edit · AI-generated'}</strong><small>{hasResult ? 'Review the garment and details before using it.' : hasGarment ? 'Reference only · not a generated result' : 'Example generated separately for illustration'}</small></div>
        </div>
        <div className="pg-preview__result" aria-live="polite"><strong>{inputRequired ? 'Input needed' : job?.status === 'needs_attention' ? 'Task needs attention' : job?.status === 'unknown' ? 'Checking your request…' : job && isGarmentJobPending(job.status) ? 'Generating your image…' : hasResult ? 'Your image is ready' : job?.status === 'succeeded' ? 'Result unavailable' : job?.status === 'failed' ? 'Generation failed' : 'Your result'}</strong><p>{inputRequired ? 'Resend the original input to continue this task.' : job?.status === 'needs_attention' ? 'Please contact support later and provide this task ID. The task will not be retried automatically.' : job?.status === 'unknown' ? 'The task status is uncertain. We will keep checking the same request.' : job?.status === 'failed' ? job.error || 'Please try again later.' : hasResult ? 'Download your image or try another garment.' : job?.status === 'succeeded' ? 'The result could not be displayed. Please check again later.' : 'Your generated image will appear here.'}</p>{(inputRequired || job?.status === 'needs_attention') && job && <p>Task ID: {job.id}</p>}{hasResult && job?.resultUrl && <button type="button" className="pg-preview__download" onClick={() => void downloadResult(job.resultUrl!)}>Download image ↓</button>}{job?.status === 'succeeded' && !hasResult && <button type="button" className="pg-preview__download" onClick={() => setJob({ id: job.id, status: 'queued' })}>Check result again</button>}{job?.status === 'needs_attention' && <button type="button" className="pg-preview__download" onClick={() => setJob({ id: job.id, status: 'queued' })}>Check status again</button>}</div>
      </div>
    </div>
    <dialog className="pg-library" ref={libraryDialog} aria-labelledby={`${id}-library-title`} onClose={() => setLibrarySlot(null)} onClick={(event) => { const rect = event.currentTarget.getBoundingClientRect(); if (event.target === event.currentTarget && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) setLibrarySlot(null); }}>
      <div className="pg-library__header"><div><p>{librarySlot === 'model' ? 'THE MODEL LIBRARY' : 'THE GARMENT LIBRARY'}</p><h2 id={`${id}-library-title`}>{librarySlot === 'model' ? 'Pick a model reference.' : 'Pick a garment.'}</h2><span>{librarySlot === 'model' ? 'Used for body type, skin tone and hair — not clothing.' : 'Examples the studio reproduces faithfully.'}</span></div><button type="button" className="pg-library__close" onClick={() => setLibrarySlot(null)} aria-label="Close reference library">×</button></div>
      <label className="pg-library__search"><span className="sr-only">Search reference library</span><input type="search" placeholder="Search references..." value={libraryQuery} onChange={(event) => setLibraryQuery(event.target.value)} /></label>
      <p className="pg-library__count" aria-live="polite">{matches.length} {matches.length === 1 ? 'reference' : 'references'}</p>
      {matches.length ? <div className="pg-library__grid">{matches.map((item) => <button type="button" key={item.id} className="pg-library__garment" aria-pressed={(librarySlot === 'garment' ? garment : model)?.id === item.id} onClick={() => pickLibrary(item)}><span className="pg-library__image"><img src={item.image} alt="" loading="lazy" /></span><strong>{item.name}</strong><small>{item.category}</small></button>)}</div> : <p className="pg-library__empty">No references found. Try another search.</p>}
    </dialog>
  </section>;
}
