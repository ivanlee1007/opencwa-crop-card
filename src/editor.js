import { escapeHtml, findCropOptions, normalizedConfig } from "./core.js";

const editorCss = `
  :host{display:block;color:var(--primary-text-color)}
  .editor{display:grid;gap:16px;padding:4px 0 12px}
  .section{display:grid;gap:10px;padding:14px;border:1px solid var(--divider-color,#ddd);border-radius:12px;background:var(--card-background-color,#fff)}
  .section-title{display:flex;align-items:center;gap:8px;font-weight:750;font-size:14px}
  .section-title ha-icon{--mdc-icon-size:20px;color:var(--primary-color,#03a9f4)}
  label.field{display:grid;gap:6px;color:var(--secondary-text-color);font-size:12px;font-weight:650}
  select,input[type=text]{width:100%;min-height:42px;padding:9px 11px;border:1px solid var(--input-idle-line-color,#a7adb2);border-radius:8px;background:var(--input-fill-color,var(--card-background-color,#fff));color:var(--primary-text-color);font:inherit;font-size:14px}
  select:focus,input:focus{outline:2px solid color-mix(in srgb,var(--primary-color,#03a9f4) 55%,transparent);outline-offset:1px}
  .toggle{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:12px;padding:8px 0;border-top:1px solid var(--divider-color,#eee)}
  .toggle:first-of-type{border-top:0}
  .toggle strong{display:block;font-size:13px}
  .toggle span{display:block;margin-top:2px;color:var(--secondary-text-color);font-size:11px;line-height:1.4}
  input[type=checkbox]{width:20px;height:20px;accent-color:var(--primary-color,#03a9f4)}
  .empty{padding:10px 12px;border-radius:8px;background:var(--secondary-background-color,#f2f4f5);font-size:12px;line-height:1.5;color:var(--secondary-text-color)}
`;

export class OpenCwaCropCardEditor extends HTMLElement {
  constructor(){super();this.attachShadow({mode:"open"});this._hass=null;this._config=normalizedConfig({});}
  set hass(value){this._hass=value;if(!this.shadowRoot.activeElement)this._render();}
  get hass(){return this._hass;}
  setConfig(config){this._config=normalizedConfig(config);this._render();}
  _emit(patch){
    const config={...this._config,...patch};
    for(const key of ["title"]) if(config[key]==="") delete config[key];
    this._config=normalizedConfig(config);
    this.dispatchEvent(new CustomEvent("config-changed",{detail:{config:{...config,type:"custom:opencwa-crop-card"}},bubbles:true,composed:true}));
    this._render();
  }
  _render(){
    if(!this.shadowRoot)return;
    const options=findCropOptions(this._hass?.states||{});
    const optionHtml=options.map((option)=>`<option value="${escapeHtml(option.entity)}" data-profile-id="${escapeHtml(option.profileId)}" ${option.entity===this._config.entity?"selected":""}>${escapeHtml(option.label)}</option>`).join("");
    const cropField=options.length?`<label class="field">OpenCWA 作物<select data-key="entity"><option value="">請選擇作物</option>${optionHtml}</select></label>`:`<div class="empty">目前找不到可設定的OpenCWA作物。請先在OpenCWA整合中啟用農業氣象，並新增至少一筆作物。</div>`;
    this.shadowRoot.innerHTML=`<style>${editorCss}</style><div class="editor"><section class="section"><div class="section-title"><ha-icon icon="mdi:sprout"></ha-icon>作物與標題</div>${cropField}<label class="field">自訂卡片標題（選填）<input type="text" data-key="title" value="${escapeHtml(this._config.title)}" placeholder="預設使用作物名稱"></label></section><section class="section"><div class="section-title"><ha-icon icon="mdi:view-dashboard-outline"></ha-icon>資訊顯示</div>${this._toggle("show_knowledge","顯示風險知識庫","列出該作物的完整災害規則與防範、復耕資訊",this._config.show_knowledge)}${this._toggle("show_source","顯示資料來源","顯示provider、資料時間與連線狀態",this._config.show_source)}${this._toggle("default_expand_alerts","預設展開全部警示","關閉時只顯示最高優先警示，其餘以+N呈現",this._config.default_expand_alerts)}</section></div>`;
    this.shadowRoot.querySelector('select[data-key="entity"]')?.addEventListener("change",(event)=>{
      const selected=event.currentTarget.selectedOptions[0];
      this._emit({entity:event.currentTarget.value,profile_id:selected?.dataset.profileId||""});
    });
    this.shadowRoot.querySelectorAll('input[type="text"]').forEach((control)=>control.addEventListener("change",(event)=>this._emit({[event.currentTarget.dataset.key]:event.currentTarget.value})));
    this.shadowRoot.querySelectorAll('input[type="checkbox"][data-value-type="boolean"]').forEach((control)=>control.addEventListener("change",(event)=>this._emit({[event.currentTarget.dataset.key]:event.currentTarget.checked===true})));
  }
  _toggle(key,title,description,checked){return `<label class="toggle"><span><strong>${escapeHtml(title)}</strong><span>${escapeHtml(description)}</span></span><input type="checkbox" data-key="${escapeHtml(key)}" data-value-type="boolean" ${checked?"checked":""}></label>`;}
}
if(!customElements.get("opencwa-crop-card-editor"))customElements.define("opencwa-crop-card-editor",OpenCwaCropCardEditor);
