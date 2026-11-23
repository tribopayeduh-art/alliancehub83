import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
// Regression: a loading return before pagination hooks caused production React #310.
test('afiliados mantém hooks antes de retornos condicionais em cada componente',()=>{
 for(const filename of ['src/components/AffiliatesView.tsx','src/components/LegacyAffiliatesView.tsx']){
  const file=ts.createSourceFile(filename,fs.readFileSync(filename,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const inspect=(node:ts.Node)=>{
   if(ts.isFunctionLike(node)&&node.body&&ts.isBlock(node.body)){
    let returned=false;
    for(const statement of node.body.statements){
     const walk=(n:ts.Node):void=>{if(n!==statement&&ts.isFunctionLike(n))return;
      if(ts.isCallExpression(n)&&ts.isIdentifier(n.expression)&&/^use[A-Z]/.test(n.expression.text))assert.equal(returned,false,`${filename}: ${n.expression.text} depois de retorno condicional`);
      if(ts.isReturnStatement(n))returned=true;
      ts.forEachChild(n,walk);
     };walk(statement);
    }
   }
   ts.forEachChild(node,inspect);
  };inspect(file);
 }
});
