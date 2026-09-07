import {service,webhook,SITE} from '../../cloud/service.js';
export const config={api:{bodyParser:false}};
async function read(req){let size=0;const chunks=[];for await(const part of req){size+=part.length;if(size>100000)throw Object.assign(Error('Request too large.'),{status:413});chunks.push(part);}return Buffer.concat(chunks);}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 const origin=req.headers.origin,extension='chrome-extension://mobgpafflgnciihjnpbfmnhpoaaipnlb';
 if(origin&&![SITE,extension].includes(origin)){res.status(403).json({error:'Origin not allowed.'});return;}
 if(origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}
 if(req.method==='OPTIONS'){res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization');res.status(204).end();return;}
 try{
  const action=req.query.action;
  if(!['GET','POST'].includes(req.method))throw Object.assign(Error('Method not allowed.'),{status:405});
  const raw=req.method==='POST'?await read(req):Buffer.alloc(0);
  const result=action==='webhook'&&req.method==='POST'?await webhook(raw,req.headers['stripe-signature']):await service(req,action,raw.length?JSON.parse(raw.toString('utf8')):{});
  res.status(200).json(result);
 }catch(error){const status=error.status||((error.name==='ZodError'||error instanceof SyntaxError)?400:500);res.status(status).json({error:status>=500&&!error.status?'The account service is temporarily unavailable. Please try again.':error.name==='ZodError'?'Invalid request.':error.message});}
}
