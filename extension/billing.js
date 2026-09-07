import identity from './identity.json';
export class Billing{
 async call(path,body,token){
  token??=(await chrome.storage.local.get('accountToken')).accountToken;
  if(!token)throw Error('Connect your account from the Mimic website first.');
  const response=await fetch(`${identity.dashboardOrigin}/api/cloud/${path}`,{method:body===undefined?'GET':'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
  const result=await response.json();if(!response.ok)throw Error(result.error||'The account service is unavailable.');return result;
 }
 async account(){if(!(await chrome.storage.local.get('accountToken')).accountToken)return {plan:'free',limits:{free:{workflows:3,batchRows:3}}};return this.call('me');}
 async connect(token){if(typeof token!=='string'||!/^mimic_[A-Za-z0-9_-]{43}$/.test(token))throw Error('Invalid account connection.');const account=await this.call('me',undefined,token);await chrome.storage.local.set({accountToken:token});return account;}
 async disconnect(){try{await this.call('revoke',{});}finally{await chrome.storage.local.remove('accountToken');}return {ok:true};}
 reserve(operationId){return this.call('reserve',{operationId});}
}
