export function createPrintQueue(normalize) {
  let entries=[];
  const get=()=>entries.map(item=>({...item}));
  const clear=()=>{entries=[];};
  function add(name,qty){const key=normalize(name);const n=Math.max(1,Math.min(999,Number(qty)||1));const found=entries.find(x=>normalize(x.name)===key);if(found)found.qty+=n;else entries.push({name,qty:n});}
  function update(index,qty){if(entries[index])entries[index].qty=Math.max(1,Math.min(999,Number(qty)||1));}
  function remove(index){entries.splice(index,1);}
  function parseDeck(s){return s.split(/\r?\n/).map(x=>x.trim()).filter(x=>x&&!x.startsWith('//')&&!/^(commander|deck|sideboard|maybeboard|creatures|lands|instants|sorceries|artifacts|enchantments|planeswalkers):?$/i.test(x)).map(line=>{const m=line.match(/^(\d+)\s*x?\s+(.+?)\s*$/i);const qty=m?Number(m[1]):1;const name=(m?m[2]:line).replace(/\s*\([^)]*\)\s*\d*\s*$/,'').trim();return {qty:Math.min(qty,999),name}}).filter(x=>x.name&&x.qty>0)}
  return {get,clear,add,update,remove,parseDeck};
}
