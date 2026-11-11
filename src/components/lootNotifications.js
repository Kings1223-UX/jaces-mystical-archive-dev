// Local notification inbox. AI backend is not connected yet.
export function initializeLootNotifications(){
const notices=[];let unread=0;
function updateUnread(){const badge=document.getElementById('unread-count');badge.textContent=unread;badge.classList.toggle('hidden',unread===0)}
// Future AI backend can call this function after authenticating the user.
function receiveLootNotice(message){notices.unshift({message,read:false});unread++;updateUnread()}
document.getElementById('loot-toggle').onclick=()=>{const panel=document.getElementById('utility-panel');panel.classList.remove('hidden');panel.replaceChildren();const title=document.createElement('h3');title.textContent='Loot · Notifications';panel.appendChild(title);if(!notices.length){const p=document.createElement('p');p.className='muted';p.textContent='No messages yet. Loot will share insights and notices here when the assistant is connected.';panel.appendChild(p)}else{for(const n of notices){const p=document.createElement('p');p.textContent=n.message;panel.appendChild(p);n.read=true}unread=0;updateUnread()}const close=document.createElement('button');close.className='secondary';close.textContent='Close';close.onclick=()=>panel.classList.add('hidden');panel.appendChild(close)};

return {receiveLootNotice};
}
