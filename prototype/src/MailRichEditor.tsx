import {useEffect,useId,useRef,useState} from 'react'
import {useEditor,EditorContent} from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TextAlign from '@tiptap/extension-text-align'
import {TextStyle,FontSize} from '@tiptap/extension-text-style'
import Image from '@tiptap/extension-image'
import {Bold,Italic,AlignLeft,AlignCenter,AlignRight,ImagePlus,Undo2,Redo2,LoaderCircle} from 'lucide-react'
import {toast} from 'sonner'
import {useLocale} from './locale'
import {mailApi} from './mail-api'
import {plainMailHtml} from '../shared/mail-html'
import logo from './assets/logo.svg'
import darkLogo from './assets/logo-dark.svg'
const MailImage=Image.extend({addAttributes(){return {...this.parent?.(),width:{default:200}}}})
export default function MailRichEditor({label,value,onChange,disabled=false,images=false,onUploadingChange,minimal=false,dark=false}:{label:string;value:string;onChange:(html:string,text:string)=>void;disabled?:boolean;images?:boolean;onUploadingChange?:(busy:boolean)=>void;minimal?:boolean;dark?:boolean}){
 const {language}=useLocale(),l=(en:string,zh:string,ms:string)=>language==='zh'?zh:language==='ms'?ms:en
 const id=useId(),input=useRef<HTMLInputElement>(null),uploadLock=useRef(false),[uploading,setUploading]=useState(false),[revision,setRevision]=useState(0)
 const editor=useEditor({extensions:[StarterKit.configure({link:false,codeBlock:false,code:false,horizontalRule:false,heading:false}),TextAlign.configure({types:['paragraph']}),TextStyle,FontSize,MailImage.configure({inline:true,allowBase64:false})],content:value,editable:!disabled,immediatelyRender:false,editorProps:{attributes:{role:'textbox','aria-label':label,'aria-multiline':'true',id},transformPastedHTML:html=>{const template=document.createElement('template');template.innerHTML=html;template.content.querySelectorAll('img').forEach(img=>{if(!img.src.startsWith('https://sengguanauto.com.my/api/mail-assets/'))img.remove()});return template.innerHTML}},onUpdate:({editor})=>onChange(editor.getHTML(),editor.getText({blockSeparator:'\n'})),onSelectionUpdate:()=>setRevision(v=>v+1),onTransaction:()=>setRevision(v=>v+1)})
 useEffect(()=>{if(editor&&value!==editor.getHTML())editor.commands.setContent(value,{emitUpdate:false})},[editor,value])
 useEffect(()=>{editor?.setEditable(!disabled&&!uploading)},[editor,disabled,uploading])
 const upload=async(file:File)=>{
  if(!editor||uploadLock.current)return
  if(file.size>10*1024*1024){toast.error(l('Choose an image smaller than 10 MB.','请选择小于10 MB的图片。','Pilih imej kurang daripada 10 MB.'));return}
  uploadLock.current=true;setUploading(true);onUploadingChange?.(true)
  try{
   const bitmap=await createImageBitmap(file);let blob:Blob
   try{const scale=Math.min(1,1200/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));canvas.getContext('2d')!.drawImage(bitmap,0,0,canvas.width,canvas.height);blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Image could not be prepared.')),'image/png'))}finally{bitmap.close()}
   if(blob.size>2*1024*1024)throw new Error(l('This image is too large. Choose a smaller logo.','图片仍然太大，请选择较小的Logo。','Imej terlalu besar. Pilih logo lebih kecil.'))
   const result=await mailApi<{url:string}>('/formatting/images',{method:'POST',body:blob,headers:{'Content-Type':blob.type}})
   if(!editor.isDestroyed)editor.chain().focus().setImage({src:result.url,alt:file.name}).run()
  }catch(e){toast.error((e as Error).message)}finally{uploadLock.current=false;setUploading(false);onUploadingChange?.(false)}
 }
 const companyLogo=async()=>{try{const image=new window.Image();image.src=dark?darkLogo:logo;await image.decode();const canvas=document.createElement('canvas');const scale=Math.min(1,1200/image.naturalWidth);canvas.width=Math.round(image.naturalWidth*scale);canvas.height=Math.round(image.naturalHeight*scale);canvas.getContext('2d')!.drawImage(image,0,0,canvas.width,canvas.height);const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Logo could not be prepared.')),'image/png'));await upload(new File([blob],'Seng Guan Auto logo.png',{type:'image/png'}))}catch(e){toast.error((e as Error).message)}}
 // Keep toolbar state in step with selection without replacing the editable DOM.
 void revision
 if(!editor)return <div className="mail-rich-loading" aria-busy="true">{label}</div>
 const locked=disabled||uploading
 return <div className={'mail-rich-field'+(minimal?' mail-rich-field--small':'')+(dark?' mail-rich-field--dark':'')}><label htmlFor={id}>{label}</label><div className="mail-rich-toolbar" role="toolbar" aria-label={label+' '+l('formatting','样式','format')}>
  <button type="button" title={l('Bold','加粗','Tebal')} aria-label={l('Bold','加粗','Tebal')} aria-pressed={editor.isActive('bold')} disabled={locked} onClick={()=>editor.chain().focus().toggleBold().run()}><Bold size={17}/></button>
  <button type="button" title={l('Italic','斜体','Condong')} aria-label={l('Italic','斜体','Condong')} aria-pressed={editor.isActive('italic')} disabled={locked} onClick={()=>editor.chain().focus().toggleItalic().run()}><Italic size={17}/></button>
  {(['left','center','right'] as const).map((align,i)=>{const Icon=[AlignLeft,AlignCenter,AlignRight][i],name=[l('Align left','靠左','Jajar kiri'),l('Align center','居中','Jajar tengah'),l('Align right','靠右','Jajar kanan')][i];return <button type="button" key={align} aria-label={name} title={name} aria-pressed={editor.isActive({textAlign:align})} disabled={locked} onClick={()=>editor.chain().focus().setTextAlign(align).run()}><Icon size={17}/></button>})}
  <select aria-label={l('Font size','字体大小','Saiz fon')} value={editor.getAttributes('textStyle').fontSize||'16px'} disabled={locked} onChange={e=>editor.chain().focus().setFontSize(e.target.value).run()}>{[10,12,14,16,18,20,24,28,32,40,48].map(size=><option key={size} value={size+'px'}>{size}px</option>)}</select>
  <button type="button" aria-label={l('Undo','撤销','Batal')} disabled={locked||!editor.can().undo()} onClick={()=>editor.chain().focus().undo().run()}><Undo2 size={17}/></button><button type="button" aria-label={l('Redo','重做','Buat semula')} disabled={locked||!editor.can().redo()} onClick={()=>editor.chain().focus().redo().run()}><Redo2 size={17}/></button>
  {images&&<><button type="button" disabled={locked} onClick={()=>input.current?.click()}>{uploading?<LoaderCircle className="login-spin" size={17}/>:<ImagePlus size={17}/>} {l('Upload image','上传图片','Muat naik imej')}</button><button type="button" disabled={locked} onClick={()=>void companyLogo()}>{l('Company logo','公司Logo','Logo syarikat')}</button><input ref={input} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)void upload(file)}}/></>}
 </div><EditorContent editor={editor}/></div>
}
export {plainMailHtml}
