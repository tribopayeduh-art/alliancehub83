import './lib/globalClickSound';
import {AppErrorBoundary} from './components/AppErrorBoundary';
import {InexBoot} from './components/InexBoot';
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './styles/ios-wallet.css';

const params = new URLSearchParams(window.location.search);
const publicHome = ['goalliancehub.com', 'www.goalliancehub.com'].includes(window.location.hostname)
  && window.location.pathname === '/'
  && !['site','game','tab','admin','p','partner','partnerCode','ref','refCode','r'].some(key => params.has(key));

if (new URLSearchParams(window.location.search).get('admin') === 'true' || window.location.hostname === 'admin.goalliancehub.com') {
  window.location.replace('/admin.html');
} else if (publicHome) {
  document.title = 'Alliance Hub | Painel de afiliados iNEX';
  document.querySelector('meta[name="description"]')?.setAttribute('content', 'Conheça o painel de afiliados iNEX para acompanhar indicações, resultados e comissões.');
  void import('./AllianceLanding').then(({default: Landing}) => {
    createRoot(document.getElementById('root')!).render(<AppErrorBoundary><Landing /></AppErrorBoundary>);
  });
} else createRoot(document.getElementById('root')!).render(
  <StrictMode><AppErrorBoundary>
    <InexBoot><App /></InexBoot>
  </AppErrorBoundary></StrictMode>,
);

import "./styles/clean-panels.css";

import "./styles/workspaces.css";
import './styles/partner-minimal.css';

import './styles/dashboard-motion.css';
