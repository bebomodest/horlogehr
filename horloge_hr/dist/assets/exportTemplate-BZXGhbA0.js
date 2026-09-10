const C="https://up6.cc/2026/03/177489580765681.png",j=async()=>{try{const d=await fetch(C,{mode:"cors",cache:"no-cache"});if(d.ok){const c=await d.blob();return new Promise(f=>{const l=new FileReader;l.onloadend=()=>f(l.result),l.onerror=()=>f(""),l.readAsDataURL(c)})}}catch{}try{return await new Promise(d=>{const c=new Image;c.crossOrigin="anonymous";const f=setTimeout(()=>d(""),4e3);c.onload=()=>{clearTimeout(f);try{const l=document.createElement("canvas");l.width=c.naturalWidth||400,l.height=c.naturalHeight||200;const u=l.getContext("2d");if(!u){d("");return}u.drawImage(c,0,0),d(l.toDataURL("image/png"))}catch{d("")}},c.onerror=()=>{clearTimeout(f),d("")},c.src=C})}catch{return""}},E=async(d,c,f,l,u,b,w,v="landscape")=>{const F=await j(),e=new Date().toLocaleDateString("ar-EG",{year:"numeric",month:"long",day:"numeric",hour:"2-digit",minute:"2-digit"}),i=b.map((h,$)=>`
    <tr class="${$%2===1?"alt":""}">
      ${h.map(y=>`<td>${y??"-"}</td>`).join("")}
    </tr>
  `).join(""),o=u.map(h=>`<th>${h}</th>`).join(""),t=w.length>0?`
    <div class="stats-section">
      <div class="stats-title">الإحصائيات</div>
      <div class="stats-grid">
        ${w.map(h=>`
          <div class="stat-card">
            <div class="stat-label">${h.label}</div>
            <div class="stat-value">${h.value}</div>
          </div>
        `).join("")}
      </div>
    </div>
  `:"",m=F?`<img src="${F}" alt="Horloge HR" style="height:65px;object-fit:contain;margin-bottom:8px;" />`:'<div style="font-size:22px;font-weight:900;color:#76151e;font-family:serif;letter-spacing:2px;margin-bottom:8px;">HORLOGE HR</div>';return`<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>${d}</title>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Cairo', Arial, sans-serif;
      background: #ffffff;
      color: #3a2a1f;
      direction: rtl;
      padding: 14mm 12mm;
    }

    /* ─── HEADER ─── */
    .header {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding-bottom: 12px;
      border-bottom: 3px solid #76151e;
      margin-bottom: 12px;
    }
    .extractor-info {
      font-size: 11px;
      color: #5a4a3f;
      background-color: #f9f5f0;
      padding: 4px 18px;
      border-radius: 20px;
      display: inline-block;
      border: 1px solid #e6dfd3;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .extractor-info b { color: #76151e; }

    /* ─── TITLES ─── */
    .report-title {
      text-align: center;
      font-size: 16px;
      font-weight: 900;
      color: #76151e;
      margin: 10px 0 4px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .report-subtitle {
      text-align: center;
      font-size: 10px;
      color: #5a4a3f;
      font-weight: 600;
      margin-bottom: 3px;
    }
    .date-info {
      text-align: center;
      font-size: 9px;
      color: #9a8a7f;
      margin-bottom: 12px;
    }

    /* ─── TABLE ─── */
    table { width: 100%; border-collapse: collapse; font-size: 9.5px; }

    thead tr {
      background-color: #76151e !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    thead th {
      padding: 7px 8px;
      text-align: center;
      font-weight: 700;
      color: #ffffff !important;
      border: 1px solid #8a1923;
      white-space: nowrap;
      background-color: #76151e !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    tbody td {
      padding: 6px 8px;
      text-align: center;
      border: 1px solid #e6dfd3;
      color: #3a2a1f;
    }
    tr.alt td {
      background-color: #faf7f3 !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    /* ─── STATS ─── */
    .stats-section {
      margin-top: 16px;
      padding-top: 12px;
      border-top: 2px solid #e6dfd3;
    }
    .stats-title {
      font-size: 13px;
      font-weight: 900;
      color: #76151e;
      margin-bottom: 10px;
      text-align: center;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: 8px;
    }
    .stat-card {
      background-color: #f9f5f0 !important;
      border: 1px solid #e6dfd3;
      border-radius: 8px;
      padding: 8px 10px;
      text-align: center;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .stat-label { font-size: 9px; color: #7a6a5f; margin-bottom: 4px; font-weight: 600; }
    .stat-value { font-size: 16px; font-weight: 900; color: #76151e; -webkit-print-color-adjust: exact; print-color-adjust: exact; }

    /* ─── FOOTER ─── */
    .footer {
      margin-top: 16px;
      padding-top: 8px;
      border-top: 1px solid #d6cfc3;
      text-align: center;
    }
    .footer-main { font-size: 9px; font-weight: 700; color: #5a4a3f; }
    .footer-sub { font-size: 7px; color: #9a8a7f; margin-top: 2px; }

    /* ─── PRINT ─── */
    @media print {
      body { padding: 8mm; }
      @page {
        size: ${v==="landscape"?"A4 landscape":"A4 portrait"};
        margin: 8mm;
      }
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    ${m}
    <div class="extractor-info">
      مستخرج التقرير: <b>${f}</b>
      &nbsp;·&nbsp;
      الوظيفة: <b>${l}</b>
    </div>
  </div>

  <div class="report-title">${d}</div>
  ${c?`<div class="report-subtitle">${c}</div>`:""}
  <div class="date-info">تاريخ الاستخراج: ${e}</div>

  <table>
    <thead><tr>${o}</tr></thead>
    <tbody>${i}</tbody>
  </table>

  ${t}

  <div class="footer">
    <div class="footer-main">Copyright © 2026, Horloge HR</div>
    <div class="footer-sub">POWERED BY NOBA AI TECHNOLOGY</div>
  </div>

  <script>
    // Auto-print after fonts and logo load
    window.onload = function() {
      setTimeout(function() {
        window.focus();
        window.print();
      }, 1200);
    };
  <\/script>
</body>
</html>`},A=(d,c,f=!1)=>{const l=window.open("","_blank","width=1100,height=800");if(!l){alert("يرجى السماح بالنوافذ المنبثقة لتصدير التقرير");return}l.document.write(d),l.document.close()},z=async(d,c,f,l,u,b,w,v,F)=>{const e=new d.Workbook,i=e.addWorksheet("تقرير");i.views=[{rightToLeft:!0}];const o=Math.max(b.length,1);let t=1;try{const r=await j();if(r){const a=r.split(",")[1],n=e.addImage({base64:a,extension:"png"});i.addImage(n,{tl:{col:Math.max(0,Math.floor(o/2)-1),row:0},ext:{width:120,height:65}})}}catch{}for(let r=0;r<4;r++)i.addRow([]),t++;const m=(r,a,n,p,R)=>{i.mergeCells(t,1,t,o);const x=i.getCell(t,1);x.value=r,x.font={name:"Cairo",bold:n,size:a,color:{argb:p}},x.alignment={horizontal:"center",vertical:"middle"},R&&(x.fill={type:"pattern",pattern:"solid",fgColor:{argb:R}}),i.getRow(t).height=a+10,t++};m(c,16,!0,"FF76151E"),f&&m(f,11,!1,"FF5A4A3F"),m(`مستخرج التقرير: ${l}  ·  الوظيفة: ${u}`,10,!1,"FF7A6A5F"),m(`تاريخ الاستخراج: ${new Date().toLocaleDateString("ar-EG",{year:"numeric",month:"long",day:"numeric"})}`,9,!1,"FF9A8A7F"),i.addRow([]),t++;const h=i.getRow(t);b.forEach((r,a)=>{const n=h.getCell(a+1);n.value=r,n.font={name:"Cairo",bold:!0,color:{argb:"FFFFFFFF"},size:11},n.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF76151E"}},n.alignment={horizontal:"center",vertical:"middle"},n.border={top:{style:"thin"},bottom:{style:"thin"},left:{style:"thin"},right:{style:"thin"}}}),i.getRow(t).height=25,t++,w.forEach((r,a)=>{const n=i.getRow(t);r.forEach((p,R)=>{const x=n.getCell(R+1);x.value=p??"-",x.font={name:"Cairo",size:10},x.alignment={horizontal:"center",vertical:"middle",wrapText:!0},x.fill={type:"pattern",pattern:"solid",fgColor:{argb:a%2===0?"FFFFFFFF":"FFFAF7F3"}},x.border={top:{style:"hair"},bottom:{style:"hair"},left:{style:"hair"},right:{style:"hair"}}}),i.getRow(t).height=20,t++}),i.columns.forEach((r,a)=>{var n;r.width=Math.min(40,Math.max(((n=b[a])==null?void 0:n.length)+4||15,...w.map(p=>String(p[a]??"").length+2)))}),v.length>0&&(i.addRow([]),t++,m("الإحصائيات",14,!0,"FF76151E","FFF9F5F0"),v.forEach(r=>{i.mergeCells(t,1,t,o);const a=i.getCell(t,1);a.value=`${r.label}:  ${r.value}`,a.font={name:"Cairo",size:11,bold:!0},a.alignment={horizontal:"center"},a.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FFFAF7F3"}},i.getRow(t).height=22,t++})),i.addRow([]),t++,m("Copyright © 2026, Horloge HR  |  POWERED BY NOBA AI TECHNOLOGY",9,!1,"FF9A8A7F");const $=await e.xlsx.writeBuffer(),y=new Blob([$],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}),s=URL.createObjectURL(y),g=document.createElement("a");g.href=s,g.download=F,g.click(),URL.revokeObjectURL(s)},L=async(d,c,f,l,u,b,w="landscape")=>{const v=await j(),F=new Date().toLocaleDateString("ar-EG",{year:"numeric",month:"long",day:"numeric",hour:"2-digit",minute:"2-digit"}),e=u.map(t=>`<th>${t}</th>`).join(""),i=b.map((t,m)=>{var y;const h=t.rows.map((s,g)=>`<tr class="${g%2===1?"alt":""}"><td>${s.map(r=>r??"-").join("</td><td>")}</td></tr>`).join(""),$=(y=t.statsRows)!=null&&y.length?`<div class="stats-grid">${t.statsRows.map(s=>`<div class="stat-card"><div class="stat-label">${s.label}</div><div class="stat-val">${s.value}</div></div>`).join("")}</div>`:"";return`<div class="section" ${m>0?'style="page-break-before:always;"':""}><div class="sec-title">${t.employeeName}</div><table><thead><tr>${e}</tr></thead><tbody>${h}</tbody></table>${$}</div>`}).join(""),o=v?`<img src="${v}" style="height:60px;object-fit:contain;margin-bottom:6px;">`:'<div style="font-size:20px;font-weight:900;color:#76151e;font-family:serif;">HORLOGE HR</div>';return`<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>${d}</title>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Cairo',Arial,sans-serif;background:#fff;color:#3a2a1f;direction:rtl;padding:12mm 10mm}
.header{display:flex;flex-direction:column;align-items:center;text-align:center;padding-bottom:10px;border-bottom:3px solid #76151e;margin-bottom:10px}
.extractor{font-size:10px;color:#5a4a3f;background:#f9f5f0;padding:3px 14px;border-radius:16px;border:1px solid #e6dfd3}
.extractor b{color:#76151e}
.report-title{text-align:center;font-size:15px;font-weight:900;color:#76151e;margin:8px 0 3px}
.report-sub{text-align:center;font-size:10px;color:#5a4a3f;font-weight:600}
.date-info{text-align:center;font-size:9px;color:#9a8a7f;margin-bottom:10px}
.section{margin-bottom:18px}
.sec-title{font-size:13px;font-weight:900;color:#fff;background:#3a2a1f;padding:7px 12px;border-radius:8px 8px 0 0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
table{width:100%;border-collapse:collapse;font-size:9px}
thead tr{background:#76151e;-webkit-print-color-adjust:exact;print-color-adjust:exact}
thead th{padding:6px 7px;text-align:center;font-weight:700;color:#fff;border:1px solid #8a1923;background:#76151e;-webkit-print-color-adjust:exact;print-color-adjust:exact}
tbody td{padding:5px 7px;text-align:center;border:1px solid #e6dfd3}
tr.alt td{background:#faf7f3;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:5px;margin-top:6px}
.stat-card{background:#f9f5f0;border:1px solid #e6dfd3;border-radius:5px;padding:5px 7px;text-align:center;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.stat-label{font-size:8px;color:#7a6a5f;margin-bottom:2px;font-weight:600}
.stat-val{font-size:12px;font-weight:900;color:#76151e;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.footer{margin-top:14px;padding-top:7px;border-top:1px solid #d6cfc3;text-align:center;font-size:9px;color:#5a4a3f}
@media print{body{padding:8mm}@page{size:${w==="landscape"?"A4 landscape":"A4 portrait"};margin:8mm}*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}}
</style></head><body>
<div class="header">${o}<div class="extractor">مستخرج التقرير: <b>${f}</b> &nbsp;·&nbsp; الوظيفة: <b>${l}</b></div></div>
<div class="report-title">${d}</div>${c?`<div class="report-sub">${c}</div>`:""}
<div class="date-info">تاريخ الاستخراج: ${F}</div>
${i}
<div class="footer">Copyright © 2026, Horloge HR &nbsp;|&nbsp; POWERED BY NOBA AI TECHNOLOGY</div>
<script>window.onload=function(){setTimeout(function(){window.focus();window.print();},1200);};<\/script>
</body></html>`},T=async(d,c,f,l,u,b,w,v)=>{const F=new d.Workbook,e=F.addWorksheet("تقرير");e.views=[{rightToLeft:!0}];const i=Math.max(b.length,1);let o=1;try{const s=await j();if(s){const g=F.addImage({base64:s.split(",")[1],extension:"png"});e.addImage(g,{tl:{col:Math.max(0,Math.floor(i/2)-1),row:0},ext:{width:120,height:60}})}}catch{}for(let s=0;s<4;s++)e.addRow([]),o++;const t=(s,g,r,a,n)=>{e.mergeCells(o,1,o,i);const p=e.getCell(o,1);p.value=s,p.font={name:"Cairo",bold:r,size:g,color:{argb:a}},p.alignment={horizontal:"center",vertical:"middle"},e.getRow(o).height=g+10,o++};t(c,15,!0,"FF76151E"),f&&t(f,10,!1,"FF5A4A3F"),t(`مستخرج التقرير: ${l}  ·  الوظيفة: ${u}`,9,!1,"FF7A6A5F"),t(`تاريخ الاستخراج: ${new Date().toLocaleDateString("ar-EG")}`,9,!1,"FF9A8A7F"),e.addRow([]),o++,w.forEach(s=>{e.mergeCells(o,1,o,i);const g=e.getCell(o,1);g.value=s.employeeName,g.font={name:"Cairo",bold:!0,size:12,color:{argb:"FFFFFFFF"}},g.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF3A2A1F"}},g.alignment={horizontal:"center",vertical:"middle"},e.getRow(o).height=24,o++;const r=e.getRow(o);b.forEach((a,n)=>{const p=r.getCell(n+1);p.value=a,p.font={name:"Cairo",bold:!0,color:{argb:"FFFFFFFF"},size:10},p.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF76151E"}},p.alignment={horizontal:"center",vertical:"middle"},p.border={top:{style:"thin"},bottom:{style:"thin"},left:{style:"thin"},right:{style:"thin"}}}),e.getRow(o).height=24,o++,s.rows.forEach((a,n)=>{const p=e.getRow(o);a.forEach((R,x)=>{const k=p.getCell(x+1);k.value=R??"-",k.font={name:"Cairo",size:9},k.alignment={horizontal:"center",vertical:"middle"},k.fill={type:"pattern",pattern:"solid",fgColor:{argb:n%2===0?"FFFFFFFF":"FFFAF7F3"}},k.border={top:{style:"hair"},bottom:{style:"hair"},left:{style:"hair"},right:{style:"hair"}}}),e.getRow(o).height=18,o++}),(s.statsRows||[]).forEach(a=>{e.mergeCells(o,1,o,i);const n=e.getCell(o,1);n.value=`${a.label}:  ${a.value}`,n.font={name:"Cairo",size:9,bold:!0},n.alignment={horizontal:"center"},n.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FFFAF7F3"}},e.getRow(o).height=18,o++}),e.addRow([]),o++,e.addRow([]),o++}),e.columns.forEach((s,g)=>{var a;let r=((a=b[g])==null?void 0:a.length)||10;w.forEach(n=>n.rows.forEach(p=>{const R=String(p[g]??"").length;R>r&&(r=R)})),s.width=Math.min(40,Math.max(r+4,14))}),t("Copyright © 2026, Horloge HR  |  POWERED BY NOBA AI TECHNOLOGY",8,!1,"FF9A8A7F");const m=await F.xlsx.writeBuffer(),h=new Blob([m],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}),$=URL.createObjectURL(h),y=document.createElement("a");y.href=$,y.download=v,y.click(),URL.revokeObjectURL($)};export{E as buildReportHTML,L as buildSectionedReportHTML,z as exportAsExcel,A as exportAsPDF,T as exportSectionedExcel};
