import { useLayoutEffect, useRef } from 'react';
import type { Character } from './model';

type Catalog = {
  feats: { name: string; html: string; luck: boolean }[];
  gear: Record<string, { cost: string; detail: string; traits: string[] }>;
  traits: Record<string, string>;
};

// Only Hugo-rendered book text is HTML; imported character text stays escaped.
const catalog: Catalog = JSON.parse(document.getElementById('character-reference-data')!.textContent!);
const equipment = new Map(Object.entries(catalog.gear));

export function CharacterReference({ character, scale, overflow }: {
  character: Character; scale: number; overflow: (label: string, invalid: boolean) => void;
}) {
  const content = useRef<HTMLDivElement>(null);
  const feats = [...new Set(character.feats.filter(name => name.trim()))];
  const gear = [...new Set(character.gear.filter(name => name.trim()))];
  const traits = [...new Set(gear.flatMap(name => equipment.get(name)?.traits ?? []))];

  useLayoutEffect(() => {
    let mounted = true;
    const measure = () => {
      if (!mounted || !content.current) return;
      const element = content.current;
      overflow('Selected reference', element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1);
    };
    measure();
    void document.fonts.ready.then(measure);
    return () => { mounted = false; };
  }, [character.feats, character.gear, overflow]);

  return <article className="reference-sheet character-reference" aria-labelledby="character-reference-heading" style={{ transform: `scale(${scale})` }}>
    <header className="reference-page-header">
      <h2 id="character-reference-heading">Selected feats, guns &amp; gear</h2>
      <span>2 / 2</span>
    </header>
    <div className="character-reference-content" ref={content}>
      <h3 className="character-reference-section">Feats</h3>
      {!feats.length && <p className="character-reference-empty">Choose feats on the character sheet to add their rules here.</p>}
      {feats.map(name => {
        const feat = catalog.feats.find(feat => feat.name === name.trim().toUpperCase());
        return <section className="reference-card" data-kind="feat" data-name={name} key={name}>
          <h3><span>{name}</span>{feat?.luck && <span className="reference-luck">1 Luck</span>}</h3>
          {feat ? <div className="reference-card-body" dangerouslySetInnerHTML={{ __html: feat.html }} />
            : <p className="character-reference-empty">Custom entry — see your character notes.</p>}
        </section>;
      })}
      <h3 className="character-reference-section">Guns &amp; gear</h3>
      {!gear.length && <p className="character-reference-empty">Choose guns &amp; gear on the character sheet to add their rules here.</p>}
      {gear.map(name => {
        const item = equipment.get(name);
        return <section className="reference-card" data-kind="gear" data-name={name} key={name}>
          <h3><span>{name}</span>{item && <span className="reference-cost">{item.cost}{item.cost !== '—' && ' Cash'}</span>}</h3>
          {item ? <div className="reference-card-body">
            {item.detail && <p>{item.detail}</p>}
            {!!item.traits.length && <p className="character-reference-traits">{item.traits.join(' · ')}</p>}
          </div> : <p className="character-reference-empty">No catalog rules for this item.</p>}
        </section>;
      })}
      {!!traits.length && <h3 className="character-reference-section">Weapon &amp; gear traits</h3>}
      {traits.map(name => <section className="reference-card" data-kind="trait" data-name={name} key={name}>
        <h3>{name}</h3>
        <div className="reference-card-body" dangerouslySetInnerHTML={{ __html: catalog.traits[name] }} />
      </section>)}
    </div>
    <p className="reference-legend">1 Luck = activation cost. Passive benefits still apply as described in the Feat. Shared equipment traits are listed once.</p>
  </article>;
}
