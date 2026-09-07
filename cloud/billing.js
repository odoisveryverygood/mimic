export const LIMITS={free:{batchRows:3,workflows:3},pro:{batchRows:100,workflows:100,monthlyRows:1000}};
export function entitlement(account,now=Date.now()){
 return account?.status==='active'&&new Date(account.periodEnd).getTime()>now?'pro':'free';
}
export function subscriptionState(subscription,priceId){
 const item=subscription.items?.data.find(i=>i.price?.id===priceId);
 return {subscriptionId:subscription.id,status:item&&subscription.status==='active'?'active':subscription.status==='active'?'free':subscription.status,periodEnd:item?.current_period_end?new Date(item.current_period_end*1000):null,updatedAt:new Date()};
}
export const billingReady=()=>!!(process.env.STRIPE_SECRET_KEY&&process.env.STRIPE_PRICE_ID&&process.env.STRIPE_WEBHOOK_SECRET&&process.env.STRIPE_ACCOUNT_ID&&process.env.MIMIC_BILLING_ENABLED==='true');
