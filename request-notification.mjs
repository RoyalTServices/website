export async function notifyRequest(reference, values, {env=process.env,createTransport}={}) {
  // Submission is already stored: mail failures must never discard customer requests.
  if(!env.SMTP_HOST||!env.SMTP_USER||!env.SMTP_PASS)return {status:'unconfigured'};
  const {customer={},payload=values}=values;
  const text=['New Royal T website request',`Reference: ${reference}`,
    ...Object.entries({...customer,...payload}).filter(([key])=>!['consent','website','requestKey'].includes(key)).map(([key,value])=>`${key}: ${typeof value==='object'?JSON.stringify(value):value??''}`)].join('\n');
  try {
    const factory=createTransport||(await import('nodemailer')).default.createTransport;
    const port=Number(env.SMTP_PORT||465);
    if(![465,587,2525].includes(port))return {status:'failed'};
    const transport=factory({
      host:env.SMTP_HOST,port,secure:port===465,requireTLS:port!==465,
      auth:{user:env.SMTP_USER,pass:env.SMTP_PASS},
      connectionTimeout:5000,greetingTimeout:5000,socketTimeout:8000,
      disableFileAccess:true,disableUrlAccess:true
    });
    try {
      const receipt=await transport.sendMail({
        from:env.SMTP_FROM||env.SMTP_USER,to:'info@royaltservices.in',
        replyTo:customer.email||values.email||undefined,
        messageId:`<request-${reference}@royaltservices.in>`,
        subject:`Royal T website request — ${reference}`,text
      });
      return {status:receipt.accepted?.includes('info@royaltservices.in')?'sent':'failed'};
    } finally {transport.close();}
  } catch {return {status:'failed'};}
}
