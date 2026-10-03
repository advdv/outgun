import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, ChangeEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { GROUPS, IDENTITY, IDENTITY_CHOICES, MAX_BACKUP_BYTES, STORAGE_KEY, WEAPONS, adventurePageUrl, changeManualPoint, chooseIdentity, chooseItem, chooseTropeAttribute, itemChoices, markValue, newCharacter, parseCharacter, ratingDetails, referencePages, tropeAttributes } from './model';
import type { Attribute, Character, ChoiceField, IdentityKey, ItemField, RatingKey } from './model';

const root = document.getElementById('character-builder')!;
const artwork = root.dataset.artwork!;
const bookPages = root.dataset.bookPages!;
const place = (x: number, y: number, w: number, h: number): CSSProperties => ({
  left: `${x}pt`, top: `${y}pt`, width: `${w}pt`, height: `${h}pt`,
});
const title = (word: string) => word[0].toUpperCase() + word.slice(1).toLowerCase();
const legacyPointsNotice = 'Existing saved points are kept as blue manual points. Role/trope bonuses now apply automatically; overlapping points are retained, with totals capped at 3.';

function loadDraft() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return { character: raw ? parseCharacter(raw) : newCharacter(), error: '',
      notice: raw && JSON.parse(raw).version === 1 ? legacyPointsNotice : '' };
  } catch {
    return {
      character: newCharacter(),
      error: 'Your saved draft could not be loaded. It has not been overwritten. Import a backup or start a new sheet; you can still edit and export this one.',
      notice: '',
    };
  }
}

function download(data: string, name: string) {
  const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

type FieldProps = {
  label: string; value: string; x: number; y: number; w: number; h: number;
  line?: number; multiline?: boolean; max?: number;
  picker?: { expanded: boolean; open: (trigger: HTMLButtonElement) => void };
  change: (value: string) => void;
  overflow: (label: string, invalid: boolean) => void;
};

function Field({ label, value, x, y, w, h, line = 14, multiline = false, max = 300, picker, change, overflow }: FieldProps) {
  const mirror = useRef<HTMLSpanElement>(null);
  const [tooLong, setTooLong] = useState(false);
  useLayoutEffect(() => {
    let mounted = true;
    const measure = () => {
      if (!mounted || !mirror.current) return;
      const element = mirror.current;
      const invalid = element.scrollHeight > element.clientHeight + 1 || element.scrollWidth > element.clientWidth + 1;
      setTooLong(invalid);
      overflow(label, invalid);
    };
    measure();
    void document.fonts.ready.then(measure);
    return () => { mounted = false; };
  }, [value, label, overflow]);
  const props = {
    'aria-label': label, 'aria-invalid': tooLong, value, maxLength: max,
    spellCheck: false, autoComplete: 'off',
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => change(event.target.value),
  };
  return <div className={`sheet-field ${multiline ? 'multiline' : ''} ${tooLong ? 'overfull' : ''}`}
    style={{ ...place(x, y, w, h), lineHeight: `${line}pt` }}>
    {picker ? <button type="button" className="sheet-choice" aria-label={`${label}: ${value || 'Not selected'}`}
      aria-haspopup="dialog" aria-expanded={picker.expanded} aria-controls={picker.expanded ? 'choice-picker' : undefined}
      onClick={event => picker.open(event.currentTarget)}>
      <span>{value}</span>
      <svg viewBox="0 0 12 12" aria-hidden="true"><path d="m3 4.5 3 3 3-3" /></svg>
    </button> : multiline ? <textarea {...props} rows={3} /> : <input {...props} type="text" />}
    <span className="print-value" ref={mirror} aria-hidden="true">{value}</span>
  </div>;
}

function ChoicePicker({ field, heading, choices, value, canClear = false, filter, attributeChoice, select, readPage, close }: {
  field: ChoiceField | ItemField;
  heading: string; choices: readonly (readonly [string, string])[]; value: string; canClear?: boolean;
  filter?: { enabled: boolean; label: string; change: (enabled: boolean) => void };
  attributeChoice?: { value: Attribute; options: Attribute[]; change: (value: Attribute) => void };
  select: (value: string) => void; close: () => void;
  readPage: (name: string, pages: number[], trigger: HTMLButtonElement) => void;
}) {
  const list = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = list.current!;
    const selected = element.querySelector<HTMLInputElement>('input:checked') || element.querySelector<HTMLInputElement>('input')!;
    selected.focus({ preventScroll: true });
    const row = selected.closest<HTMLElement>('.picker-option')!;
    element.scrollTop = row.offsetTop - (element.clientHeight - row.clientHeight) / 2;
  }, []);

  const empty = canClear ? [['', '']] : [];
  const groups = field === 'gear' ? [
    { label: '', options: empty },
    { label: 'Weapons', options: choices.filter(([name]) => WEAPONS.includes(name)) },
    { label: 'Non-weapons', options: choices.filter(([name]) => !WEAPONS.includes(name)) },
  ] : [{ label: '', options: [...empty, ...choices] }];
  const emptyLabel = field === 'role' ? 'No role' : field === 'trope' ? 'No trope' : 'Empty slot';
  return <div id="choice-picker" className="choice-picker" role="dialog" aria-labelledby="picker-heading">
    <div className="picker-header">
      <div><h2 id="picker-heading">{heading}</h2><p>Outgunned Adventure</p></div>
      <button type="button" className="picker-close" aria-label="Close picker" onClick={close}>×</button>
    </div>
    {filter && <div className="picker-filter">
      <label><input type="checkbox" checked={filter.enabled} aria-describedby="picker-filter-help"
        onChange={event => { list.current!.scrollTop = 0; filter.change(event.target.checked); }} />{filter.label}</label>
      <p id="picker-filter-help">Filters this catalog only; quantities aren’t checked.</p>
    </div>}
    {attributeChoice && <div className="picker-attribute">
      <label>Trope attribute +1
        <select value={attributeChoice.value} disabled={attributeChoice.options.length === 1}
          aria-describedby="trope-attribute-help" onChange={event => attributeChoice.change(event.target.value as Attribute)}>
          {attributeChoice.options.map(attribute => <option key={attribute} value={attribute}>{title(attribute)}</option>)}
        </select>
      </label>
      <p id="trope-attribute-help">{attributeChoice.options.length === 1
        ? 'Your role grants the other attribute, so this one is required.'
        : 'Choose which of the trope’s two attributes gets its point.'}</p>
    </div>}
    <div className="picker-list" ref={list}>
      {!choices.length && <p className="picker-notice" role="status">No matching choices in this catalog. Check your role/trope or turn off the filter.</p>}
      {filter && value && !choices.some(([name]) => name === value) && <p className="picker-notice" role="status">Your current selection is outside this list and remains on the sheet.</p>}
      <fieldset aria-labelledby="picker-heading">
        {groups.filter(group => group.options.length).map(({ label, options }) => <div className="picker-group" key={label}>
          {label && <h3 className="picker-group-heading">{label}</h3>}
          {options.map(([name, page]) => <div className="picker-option" key={name}>
            <label className="picker-select">
              <input type="radio" name="sheet-choice" value={name} aria-label={name || emptyLabel}
                checked={value === name} onChange={() => select(name)} />
              <span className="picker-name">{name || emptyLabel}</span>
              <span className="picker-check" aria-hidden="true">{value === name ? '✓' : ''}</span>
            </label>
            {page && field !== 'background' && <button type="button" className="picker-page" aria-haspopup="dialog"
              onClick={event => readPage(name, referencePages(field, page), event.currentTarget)}
              aria-label={`${name}: Outgunned Adventure, ${field === 'role' ? 'pages' : 'page'} ${referencePages(field, page).join('–')} (opens page viewer)`}>
              {field === 'role' ? 'pp.' : 'p.'} {referencePages(field, page).join('–')}
            </button>}
          </div>)}
        </div>)}
      </fieldset>
    </div>
  </div>;
}

function BookPage({ page }: { page: number }) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  return <figure className="book-page">
    <figcaption>Page {page}</figcaption>
    {status === 'loading' && <p role="status">Loading page {page}…</p>}
    {status === 'error' ? <p role="alert">Page {page} could not load. <button type="button" onClick={() => setStatus('loading')}>Retry</button></p>
      : <img src={adventurePageUrl(page, bookPages)} alt={`Outgunned Adventure, page ${page}`}
        onLoad={() => setStatus('ready')} onError={() => setStatus('error')} />}
  </figure>;
}

function BookReader({ reference, close }: { reference: { name: string; pages: number[] }; close: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const [zoomed, setZoomed] = useState(false);
  useLayoutEffect(() => {
    const element = dialog.current!;
    const html = document.documentElement;
    const { overflow, paddingRight } = html.style;
    const gutter = window.innerWidth - html.clientWidth;
    // Keep the sheet's width and scroll position while the modal owns scrolling.
    html.style.paddingRight = `${parseFloat(getComputedStyle(html).paddingRight) + gutter}px`;
    html.style.overflow = 'hidden';
    element.showModal();
    closeButton.current!.focus({ preventScroll: true });
    return () => {
      element.close();
      html.style.overflow = overflow;
      html.style.paddingRight = paddingRight;
    };
  }, []);

  return <dialog ref={dialog} className="book-viewer" aria-labelledby="book-heading" aria-describedby="book-description"
    onCancel={event => { event.preventDefault(); close(); }}>
    <header className="book-toolbar">
      <div><h2 id="book-heading">{reference.name}</h2>
        <p id="book-description">Outgunned Adventure · {reference.pages.length === 2 ? 'Pages' : 'Page'} {reference.pages.join('–')}</p></div>
      <div className="book-actions">
        <button type="button" aria-pressed={zoomed} onClick={() => {
          setZoomed(!zoomed); scroller.current!.scrollTo(0, 0);
        }}>{zoomed ? 'Fit pages' : 'Zoom in'}</button>
        <button type="button" className="book-close" ref={closeButton} aria-label="Close page viewer" onClick={close}>Close ×</button>
      </div>
    </header>
    <div className="book-scroll" ref={scroller} tabIndex={0} role="region" aria-label="Rulebook pages">
      <div className={`book-pages ${zoomed ? 'is-zoomed' : ''}`}>
        {reference.pages.map(page => <BookPage key={page} page={page} />)}
      </div>
    </div>
  </dialog>;
}

type MarkProps = {
  label: string; value: number; count: number; minimum?: number;
  x: number; y: number; step: number; kind: 'luck' | 'grit' | 'cash' | 'ammo';
  change: (value: number) => void;
};

function Marks({ label, value, count, minimum = 0, x, y, step, kind, change }: MarkProps) {
  const [w, h] = { luck: [19, 26], grit: [21, 21], cash: [14, 14], ammo: [10, 20] }[kind];
  return <div role="group" aria-label={`${label}: ${value} of ${count}`}>
    {Array.from({ length: count }, (_, i) => <button type="button" key={i}
      className={`sheet-mark ${kind}`} style={place(x + step * i, y, w, h)}
      aria-label={`${label} ${i + 1} of ${count}`} aria-pressed={i < value}
      disabled={i < minimum}
      title={i < minimum ? `${label}: starting point` : `${label}: set to ${markValue(value, i + 1, minimum)}`}
      onClick={() => change(markValue(value, i + 1, minimum))}>
      <svg viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
        {i < value && kind === 'luck' && <><rect x=".4" y=".4" width="18.2" height="25.2" fill="#634123" /><path d="M11 4 4 14 9 14 6 22 15 11 10 11Z" fill="#fcfaf4" /></>}
        {i < value && kind === 'grit' && <path d="M0 3 10.5 0 21 3 20 12 16 18 10.5 21 5 18 1 12Z" transform="translate(3.99 3.8) scale(.62)" fill="#634123" />}
        {i < value && kind === 'cash' && <><circle cx="7" cy="7" r="6.2" fill="#634123" /><text x="7" y="10.1" textAnchor="middle" fill="#fcfaf4" fontFamily="Arial" fontWeight="bold" fontSize="9">$</text></>}
        {i < value && kind === 'ammo' && <path d="M2.5 16.5V6.5L5 1.5 7.5 6.5V16.5Z" fill="#634123" />}
      </svg>
    </button>)}
  </div>;
}

function RatingMarks({ name, points, y, change }: {
  name: RatingKey; points: ReturnType<typeof ratingDetails>[RatingKey]; y: number; change: (point: number) => void;
}) {
  const { total, base, manual, granted, overlap } = points;
  return <div role="group" aria-label={`${title(name)}: ${total} of 3; ${base} starting, ${granted} role/trope, ${manual} manual${overlap ? `, ${overlap} overlapping` : ''}`}>
    {[0, 1, 2].map(index => {
      const isManual = index >= total - manual && index < total;
      const locked = index < total - manual;
      const description = isManual ? 'Manual point; click to remove. Role/trope points are retained.'
        : locked ? index < base ? 'Starting point' : 'Role/trope point; change the role or trope to remove it.' : 'Add manual points';
      const color = isManual ? '#156a92' : '#634123';
      return <button key={index} type="button" className={`sheet-mark rating-mark${isManual ? ' manual-point' : ''}`}
        style={place(182 + 15 * index, y, 12, 12)} aria-label={`${title(name)} ${index + 1} of 3`}
        aria-description={description} aria-pressed={index < total} disabled={locked} title={description}
        onClick={() => change(index + 1)}>
        <svg viewBox="0 0 12 12" aria-hidden="true">
          <path d="M6 2.6 9.4 6 6 9.4 2.6 6Z" fill={index < total ? color : '#fcfaf4'} stroke={color} strokeWidth=".7" />
          {isManual && <circle cx="6" cy="6" r=".85" fill="#fcfaf4" />}
        </svg>
      </button>;
    })}
  </div>;
}

function App() {
  const [loaded] = useState(loadDraft);
  const [character, setCharacter] = useState(loaded.character);
  const [savingEnabled, setSavingEnabled] = useState(!loaded.error);
  const [saveStatus, setSaveStatus] = useState(loaded.error ? 'Local saving unavailable' : 'Saved on this device');
  const [message, setMessage] = useState(loaded.error || loaded.notice);
  const [overflows, setOverflows] = useState<Record<string, boolean>>({});
  const [zoom, setZoom] = useState('fit');
  const [availableWidth, setAvailableWidth] = useState(1123);
  const [artReady, setArtReady] = useState(false);
  const [picker, setPicker] = useState<ChoiceField | { field: ItemField; index: number } | null>(null);
  const [itemLimits, setItemLimits] = useState({ feats: true, gear: true });
  const [reference, setReference] = useState<{ name: string; pages: number[] } | null>(null);
  const pickerTrigger = useRef<HTMLButtonElement | null>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const backupInput = useRef<HTMLInputElement>(null);
  const portraitInput = useRef<HTMLInputElement>(null);
  const invalidFields = Object.keys(overflows).filter(key => overflows[key]);
  const scale = zoom === 'fit' ? Math.min(1, availableWidth / (297 * 96 / 25.4)) : 1;
  const ratings = ratingDetails(character);
  const overlaps = Object.entries(ratings).filter(([, points]) => points.overlap);
  const attributeOptions = tropeAttributes(character.identity);

  const closePicker = useCallback(() => {
    setPicker(null);
    pickerTrigger.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (!picker || reference) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); closePicker(); }
    };
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Element && !event.target.closest('#choice-picker, .sheet-choice')) closePicker();
    };
    window.addEventListener('keydown', escape);
    document.addEventListener('pointerdown', outside);
    return () => {
      window.removeEventListener('keydown', escape);
      document.removeEventListener('pointerdown', outside);
    };
  }, [picker, reference, closePicker]);

  useEffect(() => {
    const observer = new ResizeObserver(entries => setAvailableWidth(entries[0].contentRect.width));
    observer.observe(viewport.current!);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!savingEnabled) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(character));
      setSaveStatus('Saved on this device');
    } catch {
      setSaveStatus('Not saved — export a backup');
      setMessage('Browser storage is unavailable or full. Your edits are still here; export a backup before leaving.');
    }
  }, [character, savingEnabled]);

  const overflow = useCallback((label: string, invalid: boolean) => {
    setOverflows(previous => previous[label] === invalid ? previous : { ...previous, [label]: invalid });
  }, []);
  const update = <K extends keyof Character>(key: K, value: Character[K]) =>
    setCharacter(previous => ({ ...previous, [key]: value }));
  const updateList = (key: ItemField, index: number, value: string) =>
    setCharacter(previous => chooseItem(previous, key, index, value));
  const rating = (name: RatingKey, point: number) =>
    setCharacter(previous => changeManualPoint(previous, name, point));

  async function importBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      if (file.size > MAX_BACKUP_BYTES) throw new Error('Backups must be smaller than 1 MB.');
      const raw = await file.text();
      const imported = parseCharacter(raw);
      if (!window.confirm('Replace the current sheet with this backup? Export first if you want to keep it.')) return;
      setCharacter(imported);
      setSavingEnabled(true);
      setMessage(`Character imported.${JSON.parse(raw).version === 1 ? ` ${legacyPointsNotice}` : ''}`);
    } catch (error) {
      setMessage(`Import failed; your sheet is unchanged. ${error instanceof Error ? error.message : ''}`);
    }
  }

  async function uploadPortrait(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 8_000_000)
        throw new Error('Choose a JPG, PNG or WebP image smaller than 8 MB.');
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement('canvas');
      canvas.width = 404;
      canvas.height = 568;
      const context = canvas.getContext('2d')!;
      context.fillStyle = '#fcfaf4';
      context.fillRect(0, 0, canvas.width, canvas.height);
      const ratio = Math.max(canvas.width / bitmap.width, canvas.height / bitmap.height);
      context.drawImage(bitmap, (canvas.width - bitmap.width * ratio) / 2,
        (canvas.height - bitmap.height * ratio) / 2, bitmap.width * ratio, bitmap.height * ratio);
      bitmap.close();
      update('portrait', canvas.toDataURL('image/jpeg', 0.88));
      setMessage('Portrait added and center-cropped to the frame.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'This image could not be opened.');
    }
  }

  async function printSheet() {
    if (invalidFields.length) return;
    try {
      await document.fonts.ready;
      await Promise.all(Array.from(document.querySelectorAll<HTMLImageElement>('.character-sheet img')).map(image => image.decode()));
      window.print();
    } catch {
      setMessage('An image could not load. Reload the page before printing.');
    }
  }

  const identityPositions: Record<IdentityKey, [number, number, number]> = {
    name: [155, 39, 338], role: [155, 69, 338], trope: [155, 99, 338],
    background: [155, 129, 245], age: [417, 129, 76], flaw: [155, 159, 338], catchphrase: [155, 189, 338],
  };

  return <>
    <div className="builder-toolbar" aria-label="Sheet tools">
      <div className="builder-actions">
        <button type="button" className="builder-primary" onClick={printSheet} disabled={!artReady || invalidFields.length > 0}>Print / save PDF</button>
        <button type="button" onClick={() => download(JSON.stringify(character, null, 2), `${character.identity.name.replace(/[^a-z0-9-]/gi, '-').slice(0, 60) || 'adventurer'}.json`)}>Export backup</button>
        <button type="button" onClick={() => backupInput.current?.click()}>Import backup</button>
        <button type="button" onClick={() => {
          if (window.confirm('Start a new blank sheet? Export a backup first to keep this character.')) {
            setCharacter(newCharacter()); setSavingEnabled(true); setMessage('New sheet started.');
          }
        }}>New sheet</button>
      </div>
      <div className="builder-view">
        <span className="save-status" role="status">{saveStatus}</span>
        <label>View <select value={zoom} onChange={event => setZoom(event.target.value)} aria-label="Sheet zoom">
          <option value="fit">Fit width</option><option value="100">100%</option>
        </select></label>
      </div>
      <input ref={backupInput} className="file-input" type="file" accept="application/json,.json" aria-label="Import character backup" onChange={importBackup} />
      <input ref={portraitInput} className="file-input" type="file" accept="image/jpeg,image/png,image/webp" aria-label="Upload portrait" onChange={uploadPortrait} />
    </div>
    {message && <p className="builder-message" role="status">{message} <button type="button" onClick={() => setMessage('')} aria-label="Dismiss message">×</button></p>}
    {invalidFields.length > 0 && <p className="builder-warning" role="alert">Text exceeds the printed space in {invalidFields.join(', ')}. Shorten it before printing; the sheet will not shrink or add pages.</p>}
    <div className="rating-legend">
      <span><b aria-hidden="true">◆</b> Starting + role/trope points</span>
      <span className="manual-key"><b aria-hidden="true">◇</b> Manual points — click blue to remove</span>
    </div>
    <div className="sheet-viewport" ref={viewport}>
      <div className="sheet-stage" style={{ width: `${297 * scale}mm`, height: `${210 * scale}mm` }}>
        <form className="character-sheet" aria-label="Outgunned Adventure character sheet" onSubmit={event => event.preventDefault()}
          style={{ transform: `scale(${scale})` }}>
          <img className="sheet-artwork" src={artwork} alt="" draggable="false" onLoad={() => setArtReady(true)} onError={() => setMessage('The sheet artwork could not load. Reload before printing.')} />
          <button type="button" className="sheet-portrait" style={place(25, 24, 101, 142)}
            aria-label={character.portrait ? 'Replace portrait' : 'Add portrait'} onClick={() => portraitInput.current?.click()}>
            {character.portrait && <img src={character.portrait} alt="Character portrait" />}
            <span>{character.portrait ? 'Replace portrait' : '+ Add portrait'}</span>
          </button>
          {IDENTITY.map(key => {
            const [x, y, w] = identityPositions[key];
            const label = title(key) + (key === 'name' || key === 'role' || key === 'trope' ? '' : ' (flavor)');
            return <Field key={key} label={label} value={character.identity[key]} x={x} y={y + 1} w={w} h={14}
              picker={key !== 'name' ? {
                expanded: picker === key,
                open: trigger => { pickerTrigger.current = trigger; setPicker(key); },
              } : undefined}
              change={value => setCharacter(previous => ({ ...previous, identity: { ...previous.identity, [key]: value } }))} overflow={overflow} />;
          })}
          <Marks label="Luck" kind="luck" value={character.luck} count={6} x={548} y={62} step={42} change={value => update('luck', value)} />
          <Marks label="Grit" kind="grit" value={character.grit} count={12} x={520} y={159} step={24.7} change={value => update('grit', value)} />
          {GROUPS.map(([attribute, skills], group) => <div key={attribute} role="group" aria-label={title(attribute)}>
            <RatingMarks name={attribute} points={ratings[attribute]} y={221 + group * 72} change={point => rating(attribute, point)} />
            {skills.map((skill, index) => <RatingMarks key={skill} name={skill} points={ratings[skill]}
              y={237 + group * 72 + index * 12.5} change={point => rating(skill, point)} />)}
          </div>)}
          {character.feats.map((value, index) => <Field key={`feat-${index}`} label={`Feat ${index + 1}`} value={value}
            x={264} y={247 + index * 53} w={231} h={42} multiline max={4000} line={14}
            picker={{
              expanded: typeof picker === 'object' && picker?.field === 'feats' && picker.index === index,
              open: trigger => { pickerTrigger.current = trigger; setPicker({ field: 'feats', index }); },
            }}
            change={value => updateList('feats', index, value)} overflow={overflow} />)}
          {character.gear.map((value, index) => <Field key={`gear-${index}`} label={`Gear ${index + 1}`} value={value}
            x={527} y={254 + index * 23} w={index < 3 ? 233 : 280} h={17} line={17}
            picker={{
              expanded: typeof picker === 'object' && picker?.field === 'gear' && picker.index === index,
              open: trigger => { pickerTrigger.current = trigger; setPicker({ field: 'gear', index }); },
            }}
            change={value => updateList('gear', index, value)} overflow={overflow} />)}
          {character.ammo.map((value, index) => <Marks key={`ammo-${index}`} label={`Weapon ${index + 1} ammunition`} kind="ammo" value={value}
            count={3} x={768.5} y={251.5 + index * 23} step={15} change={value => setCharacter(previous => ({ ...previous, ammo: previous.ammo.map((v, i) => i === index ? value : v) }))} />)}
          <Marks label="Cash" kind="cash" value={character.cash} count={5} x={694} y={405} step={26} change={value => update('cash', value)} />
          <Field label="Backpack" value={character.backpack} x={556} y={462} w={113} h={95} line={19} multiline max={4000} change={value => update('backpack', value)} overflow={overflow} />
          <Field label="Bag" value={character.bag} x={697} y={462} w={112} h={95} line={19} multiline max={4000} change={value => update('bag', value)} overflow={overflow} />
          {invalidFields.length > 0 && <span className="sheet-overflow-note">Text does not fit: {invalidFields.join(', ')}. Shorten it before printing.</span>}
        </form>
      </div>
    </div>
    <div className="builder-notes">
      {overlaps.length > 0 && <p className="rating-overlap" role="status">Manual points overlap role/trope bonuses in {overlaps.map(([name, points]) => `${title(name)} (${points.overlap})`).join(', ')}. Totals are capped at 3; your blue points are kept. Remove or reassign them, or change your role/trope.</p>}
      <p><strong>A4 landscape · 297 × 210 mm.</strong> The screen and print use this same sheet. Click a chevron to choose from the book; click other writing lines to type. Click a tracker to fill through it, or its last filled mark to erase it. On a small screen, use 100% and scroll to edit comfortably.</p>
      <p>Selections update immediately. Click outside a panel or press Escape to close it. Role/trope points apply automatically; No role or No trope removes only their bonuses. Choose the trope’s attribute in its panel. Brown points are locked; click an empty diamond to add manual points or a blue diamond to remove them. Manual additions survive role/trope changes; free-point budgets aren’t enforced. Feats default to role/trope choices and gear to role starting choices; turn off each panel’s filter to browse its full catalog. Filters don’t remove existing picks or enforce quantities. Flavor choices remain unrestricted; this variant uses Adult only. Choose Empty slot to remove a feat or gear entry. Hot and other resources remain manual. Drafts stay in this browser; export a backup to move devices or keep another character. When printing, use A4 landscape, 100% scale, no margins and no browser headers/footers.</p>
      {character.portrait && <button type="button" onClick={() => update('portrait', null)}>Remove portrait</button>}
    </div>
    {picker && <ChoicePicker key={typeof picker === 'string' ? picker : `${picker.field}-${picker.index}`}
      field={typeof picker === 'string' ? picker : picker.field}
      heading={typeof picker === 'string' ? `Choose ${picker === 'age' ? 'an' : 'a'} ${picker}` : picker.field === 'feats' ? 'Choose a feat' : 'Choose guns & gear'}
      choices={typeof picker === 'string' ? IDENTITY_CHOICES[picker] : itemChoices(picker.field, character.identity, itemLimits[picker.field])}
      value={typeof picker === 'string' ? character.identity[picker] : character[picker.field][picker.index]}
      canClear={typeof picker !== 'string' || picker === 'role' || picker === 'trope'}
      attributeChoice={picker === 'trope' && attributeOptions.length ? {
        value: character.tropeAttribute as Attribute, options: attributeOptions,
        change: attribute => setCharacter(previous => chooseTropeAttribute(previous, attribute)),
      } : undefined}
      filter={typeof picker === 'string' ? undefined : {
        enabled: itemLimits[picker.field],
        label: picker.field === 'feats' ? 'Only role & trope feats' : 'Only role starting gear',
        change: enabled => setItemLimits(previous => ({ ...previous, [picker.field]: enabled })),
      }}
      select={value => typeof picker === 'string'
        ? setCharacter(previous => chooseIdentity(previous, picker, value)) : updateList(picker.field, picker.index, value)}
      readPage={(name, pages, trigger) => {
        trigger.focus({ preventScroll: true });
        setReference({ name, pages });
      }}
      close={closePicker} />}
    {reference && <BookReader reference={reference} close={() => setReference(null)} />}
  </>;
}

createRoot(root).render(<App />);
