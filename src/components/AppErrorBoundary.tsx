import React from 'react';
export class AppErrorBoundary extends React.Component<{children:React.ReactNode},{failed:boolean}>{
 declare props:{children:React.ReactNode};
 state={failed:false};
 static getDerivedStateFromError(){return{failed:true};}
 componentDidCatch(){console.error('[iNEX] Falha de renderização. Atualize para recuperar a sessão.');}
 render(){if(!this.state.failed)return this.props.children;return <main role="alert" style={{minHeight:'100dvh',display:'grid',placeItems:'center',background:'#f6f7f9',padding:24,fontFamily:'system-ui'}}><section style={{maxWidth:440,width:'100%',background:'#fff',border:'1px solid #e4e7eb',borderRadius:20,padding:28}}><h1 style={{fontSize:22,color:'#242d36'}}>Vamos recuperar esta tela</h1><p style={{fontSize:14,lineHeight:1.7,color:'#647180'}}>Ocorreu uma falha ao mostrar os dados. Seus registros permanecem no servidor. Atualize a página; em operações financeiras, confira o histórico antes de solicitar novamente.</p><button onClick={()=>location.reload()} style={{padding:'13px 20px',minHeight:44,background:'#252e36',color:'white',border:0,borderRadius:10,cursor:'pointer'}}>Atualizar com segurança</button></section></main>;}
}
