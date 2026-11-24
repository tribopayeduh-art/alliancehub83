// Generate crawler-readable entry pages without changing gameplay or referral handling.
export const games = [
  ['blockwin','blockwinner.site','Block Win','Combine blocos e complete linhas no quebra-cabeça Block Win.','/blocklogo.png','/faviconblock.png'],
  ['gen-dino','dinopay.site','GEN DINO','Salte obstáculos no jogo arcade GEN DINO.','/gen-dino/images/preview.png','/gen-dino/images/fav_icon.png'],
  ['raspafortuna','raspadinhaadasorte.site','Raspa Fortuna','Conheça a raspadinha digital Raspa Fortuna.','/RASPAAFORTUNA.PNG','/RASPAAFORTUNA.PNG'],
  ['subwaypay','joguesubway.surf','Subway Pay','Desvie dos obstáculos no jogo de corrida Subway Pay.','/subwaypay.png','/subwaypay.png'],
  ['bubbleblast','jogarbubble.online','Bubble Blast','Combine cores e estoure bolhas no jogo Bubble Blast.','/bubbleblast.png','/bubbleblast.png'],
];

export function gameEntry(html, [, host, title, description, image, icon]) {
  const url = 'https://' + host + '/';
  const absoluteImage = new URL(image, url).href;
  const meta = [
    ['name','description',description],['name','theme-color','#08132c'],
    ['name','apple-mobile-web-app-title',title],['property','og:type','website'],
    ['property','og:title',title],['property','og:description',description],
    ['property','og:site_name',title],['property','og:url',url],['property','og:image',absoluteImage],
    ['name','twitter:card','summary_large_image'],['name','twitter:title',title],
    ['name','twitter:description',description],['name','twitter:image',absoluteImage],
  ].map(([attr,key,value]) => `<meta ${attr}="${key}" content="${value}">`).join('\n');
  return html
    .replace(/<html lang="pt-BR">/, '<html lang="pt-BR" data-game-boot="true">')
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${title}</title>`)
    .replace(/<meta\b[^>]*(?:name|property)="(?:description|keywords|author|theme-color|apple-mobile-web-app-title|og:[^"]+|twitter:[^"]+)"[^>]*>/gi,'')
    .replace(/<link\b[^>]*rel="(?:canonical|icon|shortcut icon|apple-touch-icon|manifest)"[^>]*>/gi,'')
    .replace(/<script type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/gi,'')
    .replace(/<script>\s*\(\(\) => \{\s*const query=new URLSearchParams\(location.search\);[\s\S]*?<\/script>/,'')
    .replace('</head>', `${meta}\n<link rel="canonical" href="${url}">\n<link rel="icon" href="${icon}">\n<link rel="apple-touch-icon" href="${icon}">\n</head>`);
}
