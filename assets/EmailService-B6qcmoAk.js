import{x as m}from"./index-D9LyxCrP.js";class u{static async getApiKey(){var t;try{const{data:e}=await m.from("system_settings").select("setting_value").eq("setting_key","resend_api_key").maybeSingle();if((t=e==null?void 0:e.setting_value)!=null&&t.trim())return e.setting_value.trim()}catch(e){console.warn("[EmailService] Failed to load key from DB:",e)}return"re_LC67xHMM_KZGiGxgDxFHb931NVAj62ED8"}static async getFromEmail(){var t;try{const{data:e}=await m.from("system_settings").select("setting_value").eq("setting_key","resend_from_email").maybeSingle();if((t=e==null?void 0:e.setting_value)!=null&&t.trim())return e.setting_value.trim()}catch{}return"ATCIS Tender System <noreply@devaxis.co.zm>"}static async sendEmail(t){try{const e=await this.getApiKey();if(!e)return{success:!1,error:"Resend API key is missing. Please configure it in System Settings or .env."};const n=t.from||await this.getFromEmail(),r=Array.isArray(t.to)?t.to:[t.to],o={apiKey:e,from:n,to:r,subject:t.subject,html:t.html,reply_to:t.replyTo},s=[`${"http://eywrrzu5mvbddbargh4t633q.102.210.102.40.sslip.io".replace(/\/$/,"")}/api/email/send`,"https://corsproxy.io/?https://api.resend.com/emails","https://api.resend.com/emails"];let i="";for(const d of s)try{const l={"Content-Type":"application/json"};d.includes("/api/email/send")||(l.Authorization=`Bearer ${e}`);const f=await fetch(d,{method:"POST",headers:l,body:JSON.stringify(o),signal:AbortSignal.timeout(4e3)}),p=await f.json();if(f.ok&&p.success!==!1)return console.log("[EmailService] Email sent successfully via gateway:",d,p.id),{success:!0,id:p.id||"sent-ok"};if(i=p.error||p.message||p.name||"Failed to dispatch email",(i.toLowerCase().includes("domain")||i.toLowerCase().includes("verify")||f.status===403)&&o.from!=="ATCIS Tender System <onboarding@resend.dev>"){console.warn("[EmailService] Domain pending verification in Resend. Retrying with sandbox sender onboarding@resend.dev"),o.from="ATCIS Tender System <onboarding@resend.dev>";const c=await fetch(d,{method:"POST",headers:l,body:JSON.stringify(o),signal:AbortSignal.timeout(4e3)}),g=await c.json();if(c.ok&&g.success!==!1)return{success:!0,id:g.id||"sent-ok"}}}catch(l){i=l.message||"Network / CORS Error",console.warn(`[EmailService] Gateway failed (${d}):`,i)}return{success:!1,error:i||"Failed to dispatch email across gateways"}}catch(e){return console.error("[EmailService] Exception during email send:",e),{success:!1,error:e.message||"Unknown network error sending email"}}}static async sendTenderAlertEmail(t,e){const n=e.tenderTitle||"New Tender Alert",r=e.tenderReferenceNumber||"N/A",o=e.procuringEntity||"N/A",a=e.closingDate?new Date(e.closingDate).toLocaleDateString():"N/A",s=e.category||"General",i=typeof e.estimatedValue=="number"?`$${e.estimatedValue.toLocaleString()}`:"Unspecified",d=`
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0;">
                <div style="text-align: center; margin-bottom: 24px;">
                    <div style="display: inline-block; background-color: #2563eb; color: #ffffff; font-weight: bold; font-size: 20px; padding: 8px 16px; border-radius: 8px;">
                        ATCIS TENDER INTELLIGENCE
                    </div>
                </div>
                <div style="background-color: #ffffff; padding: 24px; border-radius: 10px; border: 1px solid #cbd5e1; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                    <div style="background-color: #dbeafe; color: #1e40af; font-size: 12px; font-weight: 700; text-transform: uppercase; padding: 4px 10px; border-radius: 4px; display: inline-block; margin-bottom: 12px;">
                        ${s} OPPORTUNITY
                    </div>
                    <h2 style="color: #0f172a; margin: 0 0 12px 0; font-size: 20px; font-weight: 700; line-height: 1.3;">
                        ${n}
                    </h2>
                    <table style="width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 14px; color: #334155;">
                        <tr style="border-bottom: 1px solid #f1f5f9;">
                            <td style="padding: 10px 0; font-weight: 600; color: #64748b;">Reference No:</td>
                            <td style="padding: 10px 0; font-family: monospace; font-weight: 700;">${r}</td>
                        </tr>
                        <tr style="border-bottom: 1px solid #f1f5f9;">
                            <td style="padding: 10px 0; font-weight: 600; color: #64748b;">Procuring Entity:</td>
                            <td style="padding: 10px 0;">${o}</td>
                        </tr>
                        <tr style="border-bottom: 1px solid #f1f5f9;">
                            <td style="padding: 10px 0; font-weight: 600; color: #64748b;">Closing Date:</td>
                            <td style="padding: 10px 0; color: #dc2626; font-weight: 700;">${a}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px 0; font-weight: 600; color: #64748b;">Estimated Budget:</td>
                            <td style="padding: 10px 0; color: #059669; font-weight: 700;">${i}</td>
                        </tr>
                    </table>
                    <div style="margin-top: 24px; text-align: center;">
                        <a href="https://egp-tender-scraper.vercel.app/tenders/${e.id||""}" style="background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px; display: inline-block;">
                            View Opportunity Details &rarr;
                        </a>
                    </div>
                </div>
                <div style="text-align: center; margin-top: 20px; font-size: 12px; color: #94a3b8;">
                    This is an automated notification from your ATCIS Tender Intelligence System.
                </div>
            </div>
        `;return this.sendEmail({to:t,subject:`[Tender Alert] ${n.substring(0,60)}...`,html:d})}static async sendApprovalRequestEmail(t,e,n){const r=e.tenderTitle||"Tender Approval",o=e.tenderReferenceNumber||"N/A",s=`
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0;">
                <div style="background-color: #ffffff; padding: 24px; border-radius: 10px; border: 1px solid #cbd5e1;">
                    <div style="background-color: #fef3c7; color: #92400e; font-size: 12px; font-weight: 700; text-transform: uppercase; padding: 4px 10px; border-radius: 4px; display: inline-block; margin-bottom: 12px;">
                        ACTION REQUIRED: ${n.replace("_"," ").toUpperCase()} REVIEW
                    </div>
                    <h2 style="color: #0f172a; margin: 0 0 12px 0; font-size: 20px; font-weight: 700;">
                        Approval Requested for ${r}
                    </h2>
                    <p style="color: #475569; font-size: 14px; line-height: 1.5;">
                        A tender submission package is waiting for your formal review and sign-off.
                    </p>
                    <div style="background-color: #f1f5f9; padding: 14px; border-radius: 8px; margin: 16px 0; font-size: 14px;">
                        <strong>Reference:</strong> ${o}<br/>
                        <strong>Procuring Entity:</strong> ${e.procuringEntity||"N/A"}<br/>
                        <strong>Closing Date:</strong> ${e.closingDate?new Date(e.closingDate).toLocaleDateString():"N/A"}
                    </div>
                    <div style="margin-top: 20px; text-align: center;">
                        <a href="https://egp-tender-scraper.vercel.app/tenders/${e.id||""}" style="background-color: #059669; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px; display: inline-block;">
                            Review & Sign-Off Now &rarr;
                        </a>
                    </div>
                </div>
            </div>
        `;return this.sendEmail({to:t,subject:`[Action Required] Approval Request: ${r}`,html:s})}static async sendTestEmail(t){return this.sendEmail({to:t,subject:"ATCIS System - Resend Email Integration Verified",html:`
            <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border-radius: 12px; border: 1px solid #e2e8f0; background: #ffffff;">
                <h2 style="color: #2563eb; margin-top: 0;">Resend Email Service Connected!</h2>
                <p style="color: #334155; font-size: 15px; line-height: 1.5;">
                    Your <strong>Resend API Key</strong> is successfully configured and active in your <strong>ATCIS Tender Intelligence System</strong>.
                </p>
                <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; padding: 12px; border-radius: 8px; font-size: 14px; font-weight: 600;">
                    ✓ Status: Operational & Ready for Automated Notifications
                </div>
                <p style="color: #64748b; font-size: 12px; margin-top: 20px;">
                    Sent automatically by ATCIS System Settings.
                </p>
            </div>
        `})}static async notifyMatchingUsersForNewTender(t){try{const e=(t.category||"General").toLowerCase().trim(),{data:n}=await m.from("system_settings").select("setting_value").like("setting_key","notif_pref_%");if(!n||n.length===0)return;for(const r of n)try{const o=JSON.parse(r.setting_value);if(!o||!o.enableEmailAlerts||!Array.isArray(o.notificationEmails)||o.notificationEmails.length===0)continue;const a=(o.categories||[]).map(i=>i.toLowerCase().trim());(a.length===0||a.some(i=>e.includes(i)||i.includes(e)))&&(console.log("[EmailService] Category match! Sending automatic email alert to:",o.notificationEmails),await this.sendTenderAlertEmail(o.notificationEmails,t))}catch{}}catch(e){console.error("[EmailService] Error dispatching category tender alerts:",e)}}static async sendRFQEmailToSupplier(t){const{vendorName:e,vendorEmail:n,senderEmail:r,dueDate:o,notes:a,tender:s,items:i}=t,d=o?new Date(o).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}):"As Soon As Possible",l=[n];r&&r.includes("@")&&!l.includes(r)&&l.push(r);const f=i.map((c,g)=>`
            <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 10px 12px; font-weight: 600; text-align: center; color: #64748b;">${g+1}</td>
                <td style="padding: 10px 12px; font-weight: 500; color: #0f172a;">${c.description}</td>
                <td style="padding: 10px 12px; font-weight: 700; text-align: center; color: #2563eb;">${c.quantity}</td>
                <td style="padding: 10px 12px; text-align: center; color: #475569;">${c.unitOfMeasure||"Units"}</td>
            </tr>
        `).join(""),p=`
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 650px; margin: 0 auto; padding: 24px; background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0;">
                <div style="background-color: #0f172a; padding: 20px 24px; border-top-left-radius: 10px; border-top-right-radius: 10px;">
                    <span style="color: #38bdf8; font-weight: 800; font-size: 18px; letter-spacing: 0.5px;">REQUEST FOR QUOTATION (RFQ)</span>
                    <span style="float: right; color: #94a3b8; font-size: 13px; margin-top: 3px;">Ref: ${s.reference}</span>
                </div>

                <div style="background-color: #ffffff; padding: 24px; border-bottom-left-radius: 10px; border-bottom-right-radius: 10px; border: 1px solid #cbd5e1; border-top: none;">
                    <p style="font-size: 15px; color: #0f172a; margin-top: 0;">Dear <strong>${e}</strong>,</p>
                    <p style="font-size: 14px; color: #334155; line-height: 1.6;">
                        You are formally invited to submit a commercial price quotation for the items detailed below in support of procurement project <strong>${s.title}</strong> (${s.procuringEntity}).
                    </p>

                    <div style="background-color: #f1f5f9; border-left: 4px solid #2563eb; padding: 12px 16px; border-radius: 6px; margin: 20px 0; font-size: 13px; color: #1e293b;">
                        <div><strong>Project Title:</strong> ${s.title}</div>
                        <div style="margin-top: 4px;"><strong>Reference No:</strong> ${s.reference}</div>
                        <div style="margin-top: 4px;"><strong>Quotation Due Date:</strong> <span style="color: #dc2626; font-weight: 700;">${d}</span></div>
                    </div>

                    <h3 style="font-size: 15px; color: #0f172a; margin: 24px 0 12px 0; border-bottom: 2px solid #f1f5f9; padding-bottom: 6px;">Requested Items & Quantities</h3>

                    <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 20px;">
                        <thead>
                            <tr style="background-color: #f8fafc; border-bottom: 2px solid #cbd5e1; text-align: left; font-size: 12px; text-transform: uppercase; color: #475569;">
                                <th style="padding: 10px 12px; text-align: center; width: 40px;">#</th>
                                <th style="padding: 10px 12px;">Item Description</th>
                                <th style="padding: 10px 12px; text-align: center;">Qty</th>
                                <th style="padding: 10px 12px; text-align: center;">UoM</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${f}
                        </tbody>
                    </table>

                    ${a?`
                        <div style="margin-top: 16px; background-color: #fffbeb; border: 1px solid #fde68a; padding: 12px 16px; border-radius: 8px; font-size: 13px; color: #92400e;">
                            <strong>Special Instructions / Procurement Notes:</strong><br/>
                            ${a}
                        </div>
                    `:""}

                    <div style="margin-top: 28px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 13px; color: #475569; line-height: 1.5;">
                        <p style="margin: 0 0 8px 0;">Please reply to this email directly with your formal quotation including pricing, payment terms, and estimated delivery timeline.</p>
                        <p style="margin: 0; color: #94a3b8; font-size: 12px;">Thank you for your prompt response.</p>
                    </div>
                </div>
            </div>
        `;return this.sendEmail({to:l,subject:`Official Request for Quotation (RFQ) - ${s.title.substring(0,50)}`,html:p,replyTo:r||n})}}export{u as E};
