import { useEffect, useMemo, useState } from "react";
import type { Build } from "../core/model";
import { useStore } from "../store";
import {
  consultarEstilos, guardarEstilo, eliminarEstilo,
  type ConstruccionServidor, type EstiloEditor, type EstilosRespuesta,
} from "../server/catalog";

interface Props {
  source: ConstruccionServidor;
  build: Build;
  onClose: () => void;
}
type Selection = {type:"original"|"managed"|"imported"|"new";id:string};
const ORIGINAL:Selection={type:"original",id:"Original"};
function makeName(data:EstilosRespuesta):string {
  const used=new Set(["Original",
    ...data.estilos_editor.map(s=>s.nombre),...data.estilos_importados.map(s=>s.nombre)]);
  let n=1;
  while(used.has("Estilo "+n)) n++;
  return "Estilo "+n;
}
function normalize(map:Record<string,string>):Record<string,string> {
  const result:Record<string,string>={};
  for(const [from,to] of Object.entries(map)){
    const a=from.startsWith("minecraft:")?from:"minecraft:"+from;
    const b=to.startsWith("minecraft:")?to:"minecraft:"+to;
    if(a!==b)result[a]=b;
  }
  return result;
}
const EMPTY:EstilosRespuesta={estilos_editor:[],estilos_importados:[]};

export function StyleEditor({source,build,onClose}:Props) {
  const [data,setData]=useState<EstilosRespuesta>(EMPTY);
  const [selected,setSelected]=useState<Selection>(ORIGINAL);
  const [name,setName]=useState("Original");
  const [map,setMap]=useState<Record<string,string>>({});
  const [baseline,setBaseline]=useState(JSON.stringify({name:"Original",map:{}}));
  const [filter,setFilter]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");
  const [loading,setLoading]=useState(true);
  const [createdFromImported,setCreatedFromImported]=useState(false);

  const managedNames=new Set(data.estilos_editor.map(s=>s.nombre));
  const imported=data.estilos_importados.filter(s=>!managedNames.has(s.nombre));
  const dirty=JSON.stringify({name,map})!==baseline;

  function select(choice:Selection, next:EstilosRespuesta=data, force=false) {
    if(!force && dirty && !window.confirm("Hay reemplazos sin guardar. ¿Descartarlos?"))return;
    let label="Original";
    let values:Record<string,string>={};
    if(choice.type==="managed"){
      const style=next.estilos_editor.find(s=>s.id===choice.id);
      if(!style)return;
      label=style.nombre;
      values=normalize(style.reemplazos);
    }else if(choice.type==="imported"){
      const style=next.estilos_importados.find(s=>s.nombre===choice.id);
      if(!style)return;
      label=style.nombre;
      values=normalize(style.reemplazos);
    }else if(choice.type==="new"){
      label=choice.id;
    }
    setSelected(choice);setName(label);setMap(values);
    setBaseline(JSON.stringify({name:label,map:values}));
    setCreatedFromImported(choice.type==="imported");
    setError("");setMessage("");
    void useStore.getState().setStylePreview(values);
  }

  useEffect(()=>{
    let alive=true;
    void useStore.getState().setStylePreview({});
    void consultarEstilos(source).then(r=>{
      if(!alive)return;
      setData(r);setLoading(false);
    }).catch(err=>{
      if(!alive)return;
      setLoading(false);setError(err instanceof Error?err.message:String(err));
    });
    return ()=>{alive=false;void useStore.getState().setStylePreview(null);};
  },[source.categoria,source.id]);

  const materials=useMemo(()=>{
    const totals=build.countByPalette();
    const counts=new Map<string,number>();
    for(let i=1;i<build.palette.length;i++){
      const id=build.palette[i]?.name;
      if(!id || id==="minecraft:air" || !totals[i])continue;
      counts.set(id,(counts.get(id)??0)+totals[i]);
    }
    return [...counts.entries()].sort((a,b)=>b[1]-a[1]);
  },[build]);

  const visible=materials.filter(([id])=>id.toLowerCase().includes(filter.toLowerCase())).slice(0,150);
  function update(from:string,target:string) {
    const destination=target.trim();
    const next={...map};
    if(!destination || destination===from)delete next[from];
    else next[from]=destination.startsWith("minecraft:")?destination:"minecraft:"+destination;
    setMap(next);
    void useStore.getState().setStylePreview(next);
  }
  function newStyle(copy:boolean){
    if(dirty && !window.confirm("Hay cambios sin guardar. ¿Descartarlos?"))return;
    const label=makeName(data);
    const values=copy?{...map}:{};
    setSelected({type:"new",id:label});setName(label);setMap(values);
    setBaseline(JSON.stringify({name:label,map:values}));
    setCreatedFromImported(false);
    void useStore.getState().setStylePreview(values);
    setError("");setMessage("");
  }
  async function save(){
    if(selected.type==="original" || busy)return;
    if(!name.trim() || name.trim().toLowerCase()==="original"){
      setError("Elegí un nombre distinto de Original.");return;
    }
    setBusy(true);setError("");setMessage("");
    try {
      const style=await guardarEstilo(source,{
        ...(selected.type==="managed"?{id:selected.id}:{}),
        nombre:name.trim(),reemplazos:map,
        ...(createdFromImported?{sobrescribir_importado:true}:{}),
      });
      const loaded=await consultarEstilos(source);
      setData(loaded);
      select({type:"managed",id:style.id},loaded,true);
      setMessage("Estilo guardado. La construcción original no se modificó.");
    }catch(e){setError(e instanceof Error?e.message:String(e));}
    finally{setBusy(false);}
  }
  async function remove(){
    if(selected.type!=="managed" || busy)return;
    if(!window.confirm("¿Eliminar este estilo? El original y los otros estilos se conservan."))return;
    setBusy(true);
    try{
      await eliminarEstilo(source,selected.id);
      const next=await consultarEstilos(source);
      setData(next);select(ORIGINAL,next,true);
    }catch(e){setError(e instanceof Error?e.message:String(e));}
    finally{setBusy(false);}
  }
  function close(){
    if(dirty && !window.confirm("Hay cambios sin guardar. ¿Cerrar igualmente?"))return;
    onClose();
  }
  const readOnly=selected.type==="original" ||
    (selected.type==="imported" && imported.find(s=>s.nombre===selected.id)?.solo_mapa===false);
  const blockedImport=selected.type==="imported" &&
    imported.some(s=>s.nombre===selected.id && !s.solo_mapa);

  return <aside className="style-editor" role="dialog" aria-label="Editor de estilos">
    <div className="style-editor-head">
      <div><span className="eyebrow">Materiales · Construcción original intacta</span>
        <h2>Estilos</h2></div>
      <button className="btn" type="button" aria-label="Cerrar estilos" onClick={close}>×</button>
    </div>
    {loading ? <p>Cargando estilos…</p> : <>
      <label className="style-editor-label">Estilo activo
        <select value={selected.type+":"+selected.id} onChange={event=>{
          const [type,...parts]=event.target.value.split(":");
          select({type:type as Selection["type"],id:parts.join(":")});
        }}>
          <option value="original:Original">Original (sin reemplazos)</option>
          {data.estilos_editor.map(s=><option key={s.id} value={"managed:"+s.id}>{s.nombre}</option>)}
          {imported.map(s=><option key={s.nombre} value={"imported:"+s.nombre}>
            {s.nombre}{s.solo_mapa?"":" (solo lectura)"}</option>)}
          {selected.type==="new" && <option value={"new:"+selected.id}>{selected.id} (nuevo)</option>}
        </select>
      </label>
      <div className="style-editor-buttons">
        <button className="btn" type="button" onClick={()=>newStyle(false)}>+ Nuevo</button>
        <button className="btn" type="button" onClick={()=>newStyle(true)}>Duplicar</button>
        {selected.type==="managed" && <button className="btn" type="button" onClick={()=>void remove()} disabled={busy}>Eliminar</button>}
      </div>
      {blockedImport && <p className="style-editor-warning">
        Este estilo importado modifica posiciones de bloques. Se conserva sin cambios
        hasta habilitar la edición por celdas.</p>}
      <label className="style-editor-label">Nombre
        <input value={name} disabled={readOnly} maxLength={80} onChange={e=>setName(e.target.value)} />
      </label>
      <p className="style-editor-hint">Los reemplazos cambian el material en toda la construcción.
        No agregan ni eliminan bloques. La vista 3D es temporal.</p>
      <label className="style-editor-label">Buscar material original
        <input value={filter} onChange={e=>setFilter(e.target.value)}
          placeholder="piedra, madera, vidrio…" />
      </label>
      <div className="style-editor-materials">
        {visible.map(([from,count])=><div key={from} className="style-editor-material">
          <label title={from}>{from.replace(/^minecraft:/,"")} <small>({count})</small></label>
          <input aria-label={"Reemplazar "+from} value={map[from]??""}
            disabled={readOnly} placeholder="Sin cambios"
            onChange={e=>update(from,e.target.value)} />
        </div>)}
        {visible.length===0 && <p>Sin materiales coincidentes.</p>}
      </div>
      <div className="style-editor-footer">
        {selected.type!=="original" && !blockedImport &&
          <button className="btn btn-primary" disabled={busy || !dirty && selected.type!=="new"}
            onClick={()=>void save()}>{busy?"Guardando…":"Guardar estilo"}</button>}
        <button className="btn" onClick={close}>Cerrar</button>
        {message && <p role="status">{message}</p>}
        {error && <p role="alert" className="server-catalog-error">{error}</p>}
      </div>
    </>}
  </aside>;
}
