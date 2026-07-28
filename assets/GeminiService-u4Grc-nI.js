import{x as N}from"./index-DXf6soP6.js";const _=[{key:"openai_api_key",model:"gpt-4o",provider:"openai"},{key:"openai_api_key",model:"gpt-4o-mini",provider:"openai"},{key:"gemini_api_key",model:"gemini-2.0-flash",provider:"gemini"},{key:"gemini_api_key",model:"gemini-1.5-flash",provider:"gemini"},{key:"deepseek_api_key",model:"deepseek-chat",provider:"deepseek"}],T="https://generativelanguage.googleapis.com/v1beta/models";class D{static async callAI(r,n={}){var u,d,p,g,y,f,h,S,v,b,k,x,I;const t=["openai_api_key","gemini_api_key","deepseek_api_key"],{data:e}=await N.from("system_settings").select("setting_key, setting_value").in("setting_key",t),i={};e==null||e.forEach(o=>{var l;(l=o.setting_value)!=null&&l.trim()&&(i[o.setting_key]=o.setting_value.trim())});const s={openai_api_key:void 0,gemini_api_key:void 0,deepseek_api_key:void 0};for(const o of _)try{const l=(i[o.key]||s[o.key]||"").trim();if(!l)continue;if(console.log(`[AIService] Trying ${o.provider} (${o.model})...`),o.provider==="openai"){const m=await fetch("https://api.openai.com/v1/chat/completions",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${l}`},body:JSON.stringify({model:o.model,messages:[{role:"user",content:r}],temperature:.1,max_tokens:8192,...n.jsonMode?{response_format:{type:"json_object"}}:{}}),signal:AbortSignal.timeout(6e4)});if(m.ok){const a=await m.json(),c=(p=(d=(u=a==null?void 0:a.choices)==null?void 0:u[0])==null?void 0:d.message)==null?void 0:p.content;if(c)return{text:c,model:o.model}}else{const a=await m.json().catch(()=>({}));console.warn("[AIService] OpenAI error:",((g=a==null?void 0:a.error)==null?void 0:g.message)||m.statusText)}}else if(o.provider==="gemini"){const m=`${T}/${o.model}:generateContent?key=${l}`,a=await fetch(m,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({contents:[{parts:[{text:r}]}],generationConfig:{temperature:.1,maxOutputTokens:8192}}),signal:AbortSignal.timeout(45e3)});if(a.ok){const c=await a.json(),A=(v=(S=(h=(f=(y=c==null?void 0:c.candidates)==null?void 0:y[0])==null?void 0:f.content)==null?void 0:h.parts)==null?void 0:S[0])==null?void 0:v.text;if(A)return{text:A,model:o.model}}else{const c=await a.json().catch(()=>({}));console.warn("[AIService] Gemini error:",((b=c==null?void 0:c.error)==null?void 0:b.message)||a.statusText)}}else if(o.provider==="deepseek"){const m=await fetch("https://api.deepseek.com/chat/completions",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${l}`},body:JSON.stringify({model:o.model,messages:[{role:"user",content:r}],temperature:.1,max_tokens:8192,...n.jsonMode?{response_format:{type:"json_object"}}:{}}),signal:AbortSignal.timeout(6e4)});if(m.ok){const a=await m.json(),c=(I=(x=(k=a==null?void 0:a.choices)==null?void 0:k[0])==null?void 0:x.message)==null?void 0:I.content;if(c)return{text:c,model:o.model}}}}catch(l){console.warn(`[AIService] Provider ${o.provider} threw:`,l.message)}return console.error("[AIService] All configured providers failed."),null}static async getApiKey(){const{data:r}=await N.from("system_settings").select("setting_value").eq("setting_key","gemini_api_key").maybeSingle(),n=((r==null?void 0:r.setting_value)||void 0||"").trim();if(!n)throw new Error("Gemini API key not found.");return n}static async callGemini(r){const n=await this.callAI(r);return(n==null?void 0:n.text)||null}static async extractTenderData(r,n){try{const t=`
                You are a universal procurement data extractor. Your goal is to extract high-fidelity structured information from the provided tender/bid documentation HTML.
                
                Page URL: ${n}

                Instructions:
                1. Identify the core procurement details: Tender Title, Reference Number, Procuring Entity/Client, Closing Date/Deadline, and Scope of Work.
                2. Extract any key-value pairs related to the procurement process (e.g., Method of Procurement, Funding, Delivery Period, Site Visit info, Bid Security requirements).
                3. STRICTLY EXTRACT all "Line Items", "Specifications", "Requirements", or "Bill of Quantities". Look for tables, bulleted lists, or paragraphs detailing the exact items to be supplied. You MUST map these to the lineItems array. Never leave lineItems empty if there are items to be supplied.
                4. Identify any Downloadable Links or Attachments (PDFs, Docs, ZIPs) and extract their names and absolute URLs.
                5. Return ONLY a valid JSON object matching the schema below. No conversational text.

                JSON Structure:
                {
                    "tenderDetails": { 
                        "Title": "...", 
                        "Reference": "...",
                        "Closing Date": "...",
                        "Procuring Entity": "...",
                        "Method": "...",
                        "Location": "...",
                        "Status": "...",
                        "Any Other Key Found": "Value"
                    },
                    "lineItems": [
                        {
                            "itemNumber": "1",
                            "unspsc": "Optional code if found",
                            "lotName": "Lot name or category",
                            "lotDescription": "Longer description of requirements",
                            "description": "Short description/title",
                            "quantity": "Numeric string",
                            "unitOfMeasure": "Each, Box, Month, etc."
                        }
                    ],
                    "documents": [
                        { "name": "Document Name", "url": "https://..." }
                    ]
                }

                HTML Content:
                ${r.substring(0,8e4)}
            `,e=await this.callAI(t,{jsonMode:!0});if(!(e!=null&&e.text))return null;const i=e.text.replace(/```json/g,"").replace(/```/g,"").trim(),s=JSON.parse(i);return{tenderDetails:s.tenderDetails||{},lineItems:s.lineItems||[],documents:s.documents||[]}}catch(t){return console.error("[AIService] extractTenderData error:",t.message),null}}static async summarizeApp(r,n){try{const t=`
                You are a procurement expert. Summarize the Annual Procurement Plan (APP) for "${n}" 
                from Zimbabwe's e-GP system.

                Extract and present these fields in a structured professional format:
                - ItemID, Ref No, Class of Procurement, Object Code
                - Description of Requirements (detailed summary)
                - PMO / End-User, Procurement Method
                - Prequalification/EOI (Y/N), SPOC (Y/N)
                - Source of Funds, Estimated Budget (US$)
                - EOI Publication & Closing Dates
                - Tender Publication & Bid Closing Dates
                - Publication of Award Notice, Contract Signing Date
                - Unit of Measurement (UoM) & Quantity, Comments

                Start your response with "## PROCUREMENT INTELLIGENCE OVERVIEW"
                Use bold labels for each field. Be professional and concise.

                Data:
                ${r.substring(0,8e4)}
            `,e=await this.callAI(t);return(e==null?void 0:e.text)||null}catch(t){return console.error("[AIService] summarizeApp error:",t.message),null}}static async extractProcurementPlanItems(r){try{const n=`
                You are a data extraction expert. Extract procurement items from this Annual Procurement Plan table HTML.

                Map each row to an object with these keys:
                - "ItemID", "Ref No", "Class of Procurement", "Description of Requirements",
                - "Procurement Method", "Estimated Budget (US$)", "Quantity",
                - "Unit of Measurement (UoM)", "Tender Publication Date",
                - "Bid Closing Date", "Contract Signing Date"

                Return ONLY a valid JSON array. No markdown. No explanations.
                If no items found, return [].

                HTML Content:
                ${r.substring(0,8e4)}
            `,t=await this.callAI(n);if(!(t!=null&&t.text))return null;const e=t.text.replace(/```json/g,"").replace(/```/g,"").trim(),i=JSON.parse(e);return Array.isArray(i)?i:[]}catch(n){return console.error("[AIService] extractProcurementPlanItems error:",n.message),null}}static async analyzeTenderDocument(r,n){try{const t=`
                You are a senior procurement analyst and compliance officer. Review the provided content from a tender document (RFP/RFQ) and generate a high-precision analysis.
                
                Tender Title: ${n}

                Instructions:
                1. Provide a concise professional summary of the tender's scope and requirements.
                2. Identify at least 3 critical risks or "gotchas" in the document (e.g., tight deadlines, heavy penalties, restrictive technical specs).
                3. For each risk, suggest a practical mitigation strategy.
                4. List all mandatory legal and technical documents required for submission.
                5. Rate the overall compliance difficulty/score on a scale of 0-100 (where 100 is perfectly standard/easy and 0 is extremely complex/high-risk).
                6. STRICTLY EXTRACT all line items, required materials, specifications, bill of quantities, or requested services. You MUST look carefully through tables, bulleted lists, or paragraphs to find the exact items to be supplied. Map these to the lineItems array. Never leave lineItems empty if the document describes items or services needed.
                7. Include their respective quantities and units of measure if available.

                Important: If the provided content does NOT look like a tender document (e.g., technical files like robots.txt, logs, or error pages), explicitly state that in the summary and assign a low compliance score.

                Return ONLY a valid JSON object matching the schema below. No conversational text.

                JSON Structure:
                {
                    "summary": "...", 
                    "compliance_score": 85,
                    "tenderDetails": {
                        "Procurement Method": "...",
                        "Funding Source": "...",
                        "Bid Validity Period": "...",
                        "Delivery Location": "...",
                        "Delivery Period": "...",
                        "Estimated Value": "..."
                    },
                    "identified_risks": [
                        { "risk": "Title of risk", "severity": "High/Medium/Low", "mitigation": "How to handle it" }
                    ],
                    "required_documents": [
                        { "name": "Document Name", "status": "Pending" }
                    ],
                    "lineItems": [
                        {
                            "itemNumber": "1",
                            "description": "Short description/title",
                            "quantity": "Numeric string",
                            "unitOfMeasure": "Each, Month, etc."
                        }
                    ]
                }

                Document Content Snippet:
                ${r.substring(0,5e4)}
            `,e=await this.callAI(t,{jsonMode:!0});if(!(e!=null&&e.text))return null;const i=e.text.replace(/```json/g,"").replace(/```/g,"").trim();return{data:JSON.parse(i),model:e.model}}catch(t){const e=t instanceof Error?t.message:String(t);return console.error("[AIService] analyzeTenderDocument error:",e),null}}static async generateProposalDraft(r,n,t){try{const e=(t==null?void 0:t.name)||"Axis Solutions / Our Enterprise",i=`
                You are a senior bid manager writing a formal technical proposal for a high-value tender.
                
                Tender Title: ${r.title}
                Reference Number: ${r.ref_number||"N/A"}
                Procuring Entity / Client: ${r.client||"N/A"}
                Scope / Description: ${r.scope||"N/A"}
                Bidding Company: ${e}

                Line Items / Deliverables:
                ${JSON.stringify(n,null,2)}

                Generate a professional proposal draft structured in JSON format:
                {
                    "executiveSummary": "A compelling 2-3 paragraph executive summary explaining our value proposition, technical capability, and commitment.",
                    "technicalApproach": "A detailed 3-4 paragraph technical delivery methodology, quality assurance plan, and SLA response strategy.",
                    "complianceMatrix": "A bulleted matrix mapping key requirements to compliance status.",
                    "draftText": "The full combined markdown proposal text ready for export."
                }
                Return ONLY valid JSON.
            `,s=await this.callAI(i,{jsonMode:!0});if(!(s!=null&&s.text))return null;const u=s.text.replace(/```json/g,"").replace(/```/g,"").trim();return JSON.parse(u)}catch(e){const i=e instanceof Error?e.message:String(e);return console.error("[AIService] generateProposalDraft error:",i),null}}static async evaluateComplianceScore(r,n,t){try{const e=`
                Analyze the eligibility of our company to bid for this tender based on our current legal and technical certificates.
                
                Tender Title: ${r}
                Scope: ${n}

                Our Active Certificates & Registrations:
                ${JSON.stringify(t,null,2)}

                Return ONLY a valid JSON object:
                {
                    "eligibilityScore": 90, // integer 0-100
                    "passedChecks": ["PRAZ Certificate valid", "Tax Clearance valid"],
                    "missingOrExpired": ["NSSA Compliance Certificate near expiry"],
                    "analysis": "Short 2-sentence summary of overall eligibility and disqualification risk."
                }
            `,i=await this.callAI(e,{jsonMode:!0});if(!(i!=null&&i.text))return null;const s=i.text.replace(/```json/g,"").replace(/```/g,"").trim();return JSON.parse(s)}catch(e){const i=e instanceof Error?e.message:String(e);return console.error("[AIService] evaluateComplianceScore error:",i),null}}}export{D as GeminiService};
