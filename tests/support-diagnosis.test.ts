import test from 'node:test';
import assert from 'node:assert/strict';
import {diagnoseSupport,inferSupportTopic} from '../server/supportDiagnosis.ts';

const history=[
 {id:'other_deposit',type:'deposit',status:'approved',createdAt:'2026-11-24'},
 {id:'pending_withdrawal',type:'withdrawal',status:'processing',createdAt:'2026-11-23'},
 {id:'failed_withdrawal',type:'withdrawal',status:'failed',createdAt:'2026-11-21'},
];
test('natural language distinguishes saques and PIS IO from other topics',()=>{
 assert.equal(inferSupportTopic('Por que não caiu meu saque?'),'saque');
 assert.equal(inferSupportTopic('Transferência via PIS IO deu erro'),'pis');
 assert.equal(inferSupportTopic('Onde mudo a chave Pix?'),'configuracoes');
});
test('diagnosis uses verified movement type and exact user selected ID',()=>{
 const checked=diagnoseSupport('Meu saque ID: failed_withdrawal','saque',history,{});
 assert.equal(checked.transactionId,'failed_withdrawal');
 assert.match(checked.suggestion,/estorno/);
 const missing=diagnoseSupport('Saque ID: other_deposit','saque',history,{});
 assert.equal(missing.transactionId,undefined);
 assert.match(missing.answer,/Não encontrei esse ID/);
});
test('financial review is surfaced without instructing another payment',()=>{
 const pending=diagnoseSupport('Meu saque','saque',history,{financialReviewHold:true});
 assert.equal(pending.transactionId,'pending_withdrawal');
 assert.equal(pending.escalate,true);
 assert.match(pending.answer,/revisão financeira/);
 const guide=diagnoseSupport('Como cadastrar chave Pix','configuracoes',[],{});
 assert.equal(guide.escalate,false);
 assert.match(guide.answer,/Minhas Chaves PIX/);
});
