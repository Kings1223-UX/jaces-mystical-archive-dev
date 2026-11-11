/** Heuristic role classification for Oracle cards. Read-only, multi-label. */
const normalize=s=>String(s||'').normalize('NFKC').trim().toLowerCase();
export const ROLE_LABELS={ramp:'Ramp',draw:'Card draw',selection:'Card selection',removal:'Targeted removal',wipes:'Board wipes',counter:'Counterspells',protection:'Protection',tutor:'Tutors',recursion:'Recursion',graveyard:'Graveyard interaction'};
function cardText(card){return (card.card_faces?.length?card.card_faces:[card]).map(f=>f.oracle_text||'').join('\n')||card.oracle_text||'';}
function classify(card){
 const t=cardText(card), type=card.type_line||card.card_faces?.[0]?.type_line||'';
 const hits=new Map();
 const add=(key,confidence,reason)=>hits.set(key,{role:key,confidence,reason});
 const matches=(re)=>re.test(t);
 if(matches(/search your library for (?:a|an|up to|two|three|any number of).*?(?:land|basic land)/i)||matches(/add (?:\{[WUBRGC]\}|\{C\}|one mana|two mana|three mana)/i)&&!/(?:^|\n)\s*\{T\}: add/i.test(t)&&!/\bLand\b/i.test(type))add('ramp','heuristic','Potential mana acceleration or land search');
 if(matches(/draw (?:a|one|two|three|four|five|\d+|X) cards?/i)||matches(/draw cards? equal to/i))add('draw','high','Explicit card draw');
 if(matches(/\bscry\s*\d|\bsurveil\s*\d|look at the top .*? cards? of your library|\bimpulse\b/i))add('selection','high','Card selection or filtering');
 if(matches(/(?:destroy|exile|return) target (?:creature|artifact|enchantment|permanent|planeswalker|nonland permanent|spell)/i)||matches(/deals? \d+ damage to target (?:creature|planeswalker)/i))add('removal','heuristic','Targeted interaction');
 if(matches(/destroy all (?:creatures|artifacts|enchantments|nonland permanents|permanents)|exile all (?:creatures|permanents)|all creatures get -\d+\/-\d+|deals? \d+ damage to each creature/i))add('wipes','high','Mass removal');
 if(matches(/counter target (?:spell|instant|sorcery|creature spell|noncreature spell|activated ability|triggered ability)/i))add('counter','high','Counter effect');
 if(matches(/(?:you|creatures you control|permanents you control|target creature) (?:gain|gains|have|has) (?:hexproof|indestructible|protection)|phase out|prevent all damage that would be dealt/i))add('protection','heuristic','Protective effect');
 if(matches(/search your library for (?:a|an|up to|two|three|any number of)/i))add('tutor','heuristic','Library search (including land search)');
 if(matches(/return target .*? card from your graveyard to (?:your hand|the battlefield)|return .*? from your graveyard to (?:your hand|the battlefield)|put target .*? card from a graveyard onto the battlefield/i))add('recursion','heuristic','Recover cards from graveyard');
 if(matches(/exile (?:target|all) cards? from (?:a|target|an opponent.s) graveyard|exile target player.s graveyard|cards? in graveyards? (?:can.t|lose)|if a card would be put into an opponent.s graveyard/i))add('graveyard','heuristic','Graveyard disruption');
 return [...hits.values()];
}
export function analyzeCardRoles(entries,catalog){
 const totals=Object.fromEntries(Object.keys(ROLE_LABELS).map(k=>[k,0]));
 const details=[];const unmatched=[];
 for(const entry of entries){const quantity=Number(entry.quantity)||0;if(quantity<=0)continue;
 const card=catalog.get(normalize(entry.name));if(!card){unmatched.push(entry.name);continue;}
 const roles=classify(card);for(const role of roles)totals[role.role]+=quantity;
 if(roles.length)details.push({name:entry.name,quantity,roles});
 }
 return {totals,details,unmatched,method:'Heuristic Oracle-text matching; counts may overlap and do not establish strategic effectiveness.'};
}
