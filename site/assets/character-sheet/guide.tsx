import { useEffect, useState } from 'react';
import { useJoyride } from 'react-joyride';
import type { Step, TooltipRenderProps } from 'react-joyride';
import { STORAGE_KEY } from './model';

const GUIDE_KEY = 'outgun.guide.v1';
const sections = [
  { title: 'Pick a name', area: [155, 33, 338, 23], pin: [499, 35], placement: 'right' },
  { title: 'Pick an avatar', area: [25, 24, 101, 142], pin: [8, 174], placement: 'right' },
  { title: 'Pick a role', area: [155, 63, 338, 23], pin: [499, 65], placement: 'right' },
  { title: 'Pick a trope', area: [155, 93, 338, 23], pin: [499, 95], placement: 'right' },
  { title: 'Pick extra attributes and skills', area: [25, 217, 202, 65], pin: [5, 217], placement: 'right' },
  { title: 'Pick feats', area: [258, 241, 241, 49], pin: [239, 220], placement: 'right' },
  { title: 'Pick gear', area: [522, 247, 288, 145], pin: [811, 220], placement: 'left' },
] as const;

// Starting kits, Outgunned Adventure pp. 22–40. These are allowances, not the
// union of all catalog entries shown by the existing role filter.
const kits: Record<string, string> = {
  'The Daredevil': '3 items: a pistol or revolver, a knife, and a rope (p. 22).',
  'The Guardian': '2 picks: a weapon of choice and one 1-Cash item (p. 24).',
  'The Captain': '3 items: a pistol or revolver, an old ride, and a compass (p. 26).',
  'The Hunter': '3 picks: a hunting rifle or hunting bow, a knife, and one 1-Cash item (p. 28).',
  'The Heart': '2 picks: one 1-Cash item and one 2-Cash item (p. 30).',
  'The Star': '2 items: elegant clothes and a precious item of your choice (p. 32).',
  'The Professor': 'A diary and pencil, listed together as one kit entry (p. 34).',
  'The Technician': '3 picks: an old rifle or dynamite, a tool-bag, and a knife or lighter (p. 36).',
  'The Scoundrel': '3 items: a knife, a lighter, and one 1-Cash item of choice (p. 38).',
  'The Smuggler': '3 items: a pistol or revolver, a rope, and a lockpicking set (p. 40).',
};

function Rule({ page, children }: { page: string; children: React.ReactNode }) {
  return <details className="guide-source"><summary>Outgunned Adventure · {page}</summary>
    <blockquote>{children}</blockquote>
  </details>;
}

function GuideTooltip({ step, index, size }: TooltipRenderProps) {
  return <section className="guide-popover" role="dialog" aria-modal="false" aria-labelledby="guide-heading">
    <p className="guide-progress" aria-live="polite">{index + 1} of {size} · Create your adventurer</p>
    <h2 id="guide-heading">{step.title}</h2>
    {step.content}
  </section>;
}

export function useCharacterGuide(ready: boolean, suspended: boolean, role: string) {
  const [guide, setGuide] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(GUIDE_KEY) || 'null');
      if (saved && typeof saved.enabled === 'boolean' && typeof saved.open === 'boolean'
        && Number.isInteger(saved.index) && saved.index >= 0 && saved.index < sections.length) return {
        enabled: saved.enabled as boolean, open: saved.open as boolean, index: saved.index as number,
      };
      return { enabled: !localStorage.getItem(STORAGE_KEY), open: true, index: 0 };
    } catch { return { enabled: true, open: true, index: 0 }; }
  });
  const running = ready && guide.enabled && guide.open && !suspended;
  const jump = (index: number) => setGuide({ enabled: true, open: true, index });
  const hide = () => {
    document.querySelector<HTMLButtonElement>('.guide-toggle')?.focus({ preventScroll: true });
    setGuide(previous => ({ ...previous, enabled: false }));
  };
  const close = () => {
    const returnFocus = document.activeElement?.closest('.guide-popover');
    setGuide(previous => ({ ...previous, open: false }));
    if (returnFocus) document.getElementById(`guide-pin-${guide.index}`)?.focus({ preventScroll: true });
  };

  useEffect(() => {
    try { localStorage.setItem(GUIDE_KEY, JSON.stringify(guide)); } catch { /* Help still works without storage. */ }
  }, [guide]);

  useEffect(() => {
    if (!running) return;
    document.getElementById(`guide-target-${guide.index}`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) { event.preventDefault(); close(); }
    };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [running, guide.index]);

  const content = [
    <><p>Every adventure needs a memorable name. Type yours on the Name line: a real name, a nickname, or something worthy of a movie poster. You can change it later.</p>
      <p>Your edits save on this device. Export a backup to keep a portable copy.</p></>,
    <><p>Give your adventurer a face. Click the portrait frame to upload a JPG, PNG, or WebP image under 8 MB. It is center-cropped to fit and appears on your printed sheet.</p>
      <p>A portrait is optional. Click it again to replace it, or use Remove portrait below the sheet.</p></>,
    <><p>Your role describes what you do best. Click the Role line, then use the <strong>ⓘ page link</strong> beside any pick to read its full description.</p>
      <p>Its Attribute and Skill points apply automatically. Your role also determines your starting gear and two feats.</p>
      <Rule page="p. 20">“When you choose a Role, you gain 1 point in an Attribute and 1 point each in 10 Skills.”</Rule></>,
    <><p>Your trope gives your adventurer their personality and movie archetype. Open the Trope line and follow a pick’s <strong>ⓘ page reference</strong> to learn more.</p>
      <p>Its points apply automatically. Choose its Attribute in the panel; if your role already grants one of the two options, the other is required.</p>
      <Rule page="p. 44">“When you choose a Trope, you gain 1 point in an Attribute and 1 point each in 8 Skills.” “If your Role has already given you a point in one of the Attributes associated with your Trope, then you must choose the other one.”</Rule></>,
    <><p>Your role and trope supply <strong>2 Attribute points and 18 Skill points</strong> automatically. Now add <strong>2 extra Skill points</strong>, split between skills or both in one, up to 3 points per rating. There are no extra free Attribute points.</p>
      <p>A roll uses <strong>Attribute + Skill dice</strong>: Brawn 3 + Fight 2 means 5 dice. Higher ratings give you more dice to make matching sets.</p>
      <p>Click empty diamonds to add blue manual points; click blue to remove. Brown points are locked. The sheet does not enforce your two-point budget.</p>
      <Rule page="p. 50">“You can have up to 3 points in each Attribute and Skill.” “You can add 2 free Skill Points wherever you like.” “Choose one Attribute and one Skill and add up their scores: that is how many dice you have in your pool.”</Rule></>,
    <><p>Choose <strong>3 feats: 2 from your role and 1 from your trope</strong>. These special talents give you advantages in play. Click a feat slot, then follow the <strong>ⓘ page reference</strong> to read what each talent does.</p>
      <p>The filter shows available catalog feats from your role or trope. It does not enforce the 2 + 1 split or the total; the extra slots are for later adventures.</p>
      <Rule page="p. 52">“When creating your Adventurer, you can choose 2 Feats from the list offered by your Role and 1 from the list for your Trope.”</Rule></>,
    <><p><strong>{Object.hasOwn(kits, role) ? `${role}: ` : 'Start with your role’s kit. '}</strong>{Object.hasOwn(kits, role) ? kits[role] : 'There is no fixed item count for everyone; choose a role and check its page reference for the exact quantities.'}</p>
      <p>The gear filter follows your <strong>role, not your trope</strong>. It lists eligible items but does not enforce quantities or either/or choices. Use each item’s <strong>ⓘ page reference</strong> for details.</p>
      <p>You may ask the Director for <strong>one additional item</strong>. New sheets start with 1 Cash and 1 Luck; a feat such as Moneybags may change your Cash. Write small belongings in Backpack or Bag.</p>
      <Rule page="p. 61">“You begin the game with the equipment granted to you by your Role as well as 1 Cash.” “You can ask the Director to grant you one additional item of your choice.”</Rule></>,
  ];
  const steps: Step[] = sections.map((section, index) => ({
    target: `#guide-target-${index}`, title: section.title, placement: section.placement,
    offset: index === 0 || index === 2 || index === 3 ? 28 : 12,
    content: <>
      <button type="button" className="guide-close" aria-label="Close guide bubble" onClick={close}>×</button>
      <div className="guide-copy">{content[index]}</div>
      <div className="guide-navigation">
        <button type="button" disabled={index === 0} onClick={() => jump(index - 1)}>Back</button>
        <button type="button" className="guide-next" onClick={() => {
          if (index === sections.length - 1) hide(); else jump(index + 1);
        }}>{index === sections.length - 1 ? 'Finish guide' : `Next: ${['', 'Avatar', 'Role', 'Trope', 'Points', 'Feats', 'Gear'][index + 1]} →`}</button>
      </div>
      <button type="button" className="guide-hide" onClick={hide}>Hide guide</button>
    </>,
  }));
  const { Tour } = useJoyride({
    steps, run: running, stepIndex: guide.index, tooltipComponent: GuideTooltip,
    options: { hideOverlay: true, skipBeacon: true, disableFocusTrap: true, dismissKeyAction: false,
      skipScroll: true, offset: 12, zIndex: 15,
      arrowColor: '#fbf8f0', arrowSize: 8, arrowBase: 16 },
    floatingOptions: { strategy: 'fixed' },
  });

  return {
    enabled: guide.enabled,
    restart: () => jump(0),
    tools: <>
      <button type="button" className="guide-toggle" role="switch" aria-label="Character creation guide"
        aria-checked={guide.enabled} onClick={() => setGuide(previous => ({ ...previous, enabled: !previous.enabled, open: true }))}>
        Guide {guide.enabled ? 'on' : 'off'} <span aria-hidden="true" />
      </button>
      <button type="button" className="guide-restart" onClick={() => jump(0)}>Restart guide</button>
    </>,
    pins: guide.enabled && sections.map(({ title, area: [x, y, width, height], pin: [px, py] }, index) => <div key={title}>
      <div id={`guide-target-${index}`} className={`guide-target${running && guide.index === index ? ' is-active' : ''}`}
        aria-hidden="true" style={{ left: `${x}pt`, top: `${y}pt`, width: `${width}pt`, height: `${height}pt` }} />
      <button type="button" id={`guide-pin-${index}`} className="guide-pin" aria-label={`Step ${index + 1}: ${title}`}
        aria-current={guide.index === index ? 'step' : undefined} aria-expanded={running && guide.index === index}
        aria-haspopup="dialog" style={{ left: `${px}pt`, top: `${py}pt` }} onClick={() => jump(index)}>{index + 1}</button>
    </div>),
    tour: Tour,
  };
}
