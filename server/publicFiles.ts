import express from 'express';
import type {RequestHandler} from 'express';

// Build staging can leave HTML in public/. Development entrypoints belong to Vite.
export function publicFiles(directory:string, production:boolean):RequestHandler {
  const serve=express.static(directory,{index:false});
  return (req,res,next)=>{
    if(req.path==='/'||req.path==='/index.html'||req.path==='/admin.html')return next();
    return serve(req,res,next);
  };
}
