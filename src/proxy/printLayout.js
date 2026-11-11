import {buildCard,fitAll,el} from './cardRenderer.js';
// Preserve the approved 210 x 297 mm A4 / 63.5 x 88.9 mm card CSS.
export function createPrintLayout({pages, pageCount, preview}) {
  let mode='bw';
  function fitPreview(){const available=preview.clientWidth-12;const zoom=Math.min(1,available/(210*96/25.4));pages.querySelectorAll('.page').forEach(p=>p.style.zoom=zoom);fitAll();}
  function render(cards){pages.replaceChildren();pageCount.textContent=`${cards.length} cards · ${Math.ceil(cards.length/9)} A4 page(s)`;if(!cards.length){pages.append(el('div','empty','Add cards to your print job, then refresh the preview.'));return}for(let i=0;i<cards.length;i+=9){const page=el('section','page');cards.slice(i,i+9).forEach(c=>page.append(buildCard(c,mode)));pages.append(page)}requestAnimationFrame(fitPreview)}
  function setMode(next){mode=next;}
  return {render,fitPreview,setMode};
}
