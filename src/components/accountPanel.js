import {SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY} from '../config/supabase.js';

export async function initAccount() {
  const toggle = document.getElementById('account-toggle');
  const panel = document.getElementById('account-panel');
  if (!toggle || !panel) return;
  const configured = SUPABASE_URL.startsWith('https://') &&
    /^sb_publishable_|^eyJ/.test(SUPABASE_PUBLISHABLE_KEY);
  let client = null;
  let currentUser = null;
  let mode = 'signin';
  let requestPending = false;
  let startupError = '';
  let persistentMessage = '';
  let persistentError = false;
  const elt = (tag, text, cls) => {const x=document.createElement(tag);if(text!==undefined)x.textContent=text;if(cls)x.className=cls;return x};
  const showMessage = (message, error=false) => {
    const status=panel.querySelector('[data-account-status]');
    persistentMessage=message; persistentError=error;
    if(status){status.textContent=message;status.style.color=error?'#b4233a':'#42648a';}
  };
  const updateButton=()=>{toggle.textContent=currentUser?'●':'♙';toggle.title=currentUser?'Account: '+currentUser.email:'Sign in';};
  const refreshUser=async()=>{if(!client)return;const {data,error}=await client.auth.getUser();currentUser=error?null:data.user;updateButton();};
  function render() {
    panel.replaceChildren();
    const heading=elt('h3',currentUser?'Your account':'Jace’s Mystical Archive — Account');panel.append(heading);
    if(!configured){panel.append(elt('p','Account sign-in is not configured. Add the Supabase project URL and publishable key to src/config/supabase.js.','muted'));}
    else if(!client){panel.append(elt('p','Account service unavailable: '+(startupError||'Check your connection and try again.'),'muted'));}
    else if(currentUser){
      panel.append(elt('p','Signed in as '+currentUser.email,'muted'));
      const logout=elt('button','Sign out','secondary');logout.type='button';logout.onclick=async()=>{logout.disabled=true;const {error}=await client.auth.signOut();if(error){showMessage(error.message,true);logout.disabled=false;return;}currentUser=null;updateButton();render();};panel.append(logout);
    } else {
      const switcher=elt('div',undefined,'tabs');
      for(const [value,label] of [['signin','Sign in'],['signup','Create account'],['reset','Reset password']]){
        const btn=elt('button',label,mode===value?'active':'');btn.type='button';btn.onclick=()=>{mode=value;render()};switcher.append(btn);
      }
      panel.append(switcher);
      const form=elt('form');form.style.maxWidth='440px';
      const emailLabel=elt('label','Email','fieldlabel');const email=elt('input');email.type='email';email.required=true;email.autocomplete='email';email.className='textinput';form.append(emailLabel,email);
      let password;
      if(mode!=='reset'){
        const passwordLabel=elt('label','Password','fieldlabel');password=elt('input');password.type='password';password.required=true;password.minLength=6;password.autocomplete=mode==='signup'?'new-password':'current-password';password.className='textinput';form.append(passwordLabel,password);
      }
      const submit=elt('button',mode==='signin'?'Sign in':mode==='signup'?'Create account':'Send reset email','primary full');submit.type='submit';form.append(submit);
      form.onsubmit=async(e)=>{
        e.preventDefault();
        if(requestPending)return;
        requestPending=true; submit.disabled=true; showMessage('Contacting Supabase…');
        try{
          let result;
          if(mode==='signin')result=await client.auth.signInWithPassword({email:email.value.trim(),password:password.value});
          else if(mode==='signup')result=await client.auth.signUp({email:email.value.trim(),password:password.value,options:{emailRedirectTo:location.origin+location.pathname}});
          else result=await client.auth.resetPasswordForEmail(email.value.trim(),{redirectTo:location.origin+location.pathname});
          if(result.error)throw result.error;
          if(mode==='signin'){await refreshUser();render();showMessage('Signed in successfully.');}
          else showMessage(mode==='signup'?'Registration submitted. Check your email for confirmation. If you already have an account, try signing in.':'If the email is registered, a password-reset link will be sent.');
        }catch(error){showMessage(error.message||'Account request failed.',true)}finally{requestPending=false;submit.disabled=false;}
      };
      panel.append(form);
    }
    const status=elt('p',persistentMessage,'help');status.dataset.accountStatus='';status.setAttribute('role','status');status.style.color=persistentError?'#b4233a':'#42648a';panel.append(status);
    const close=elt('button','Close','secondary');close.type='button';close.onclick=()=>panel.classList.add('hidden');panel.append(close);
  }
  toggle.onclick=()=>{panel.classList.toggle('hidden');if(!panel.classList.contains('hidden'))render();};
  if(!configured){updateButton();return;}
  try{
    const {createClient}=await import('https://esm.sh/@supabase/supabase-js@2');
    client=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    client.auth.onAuthStateChange((_event,session)=>{const wasSignedIn=!!currentUser;currentUser=session?.user||null;updateButton();if(!requestPending&&wasSignedIn!==!!currentUser&&!panel.classList.contains('hidden'))render();});
    await refreshUser();
  }catch(err){startupError=err?.message||String(err);console.warn('Account integration unavailable:',err);}
  updateButton();
}
