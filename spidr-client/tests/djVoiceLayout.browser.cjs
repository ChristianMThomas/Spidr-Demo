const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const { browserHash } = require('../node_modules/.vite/deps/_metadata.json');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge', args: ['--autoplay-policy=no-user-gesture-required'] });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => { errors.push(error.message); console.error('PAGE ERROR',error.message); });
    page.on('console', message => { if (message.type() === 'error') console.error('BROWSER',message.text()); });
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.pathname === '/src/components/spidr/useWebRTC.js') return route.fulfill({ contentType: 'text/javascript', body: `
        const camera = document.createElement('canvas'); camera.width=320; camera.height=180;
        const ctx=camera.getContext('2d'); let frame=0;
        setInterval(()=>{ctx.fillStyle='#125943';ctx.fillRect(0,0,320,180);ctx.fillStyle='white';ctx.font='28px sans-serif';ctx.fillText('Camera '+(++frame),24,90)},50);
        const stream=camera.captureStream(20);
        const rtc={localStream:stream,remoteStreams:{peer:stream},screenStreams:{peer:stream},peers:{peer:{userId:'guest'}},isConnected:true,isMuted:false,isVideoOn:true,join(){},leave(){},toggleMute(){},toggleVideo(){},addOutgoingTrack(){},removeOutgoingTrack(){}};
        export function useWebRTC(){return rtc;}
      ` });
      if (url.pathname === '/src/hooks/useDJAudio.js') return route.fulfill({ contentType: 'text/javascript', body: `
        const audio={audioRoute:'stream',liveAudioActive:true,status:'streaming',isPlaying:false,canControlAudio:true,localVolume:80,setLocalVolume(){},togglePause(){},unlockAudio(){}};
        export default function useDJAudio(){return audio;}
      ` });
      if (url.pathname === '/__qa/voice') return route.fulfill({ contentType: 'text/html', body: `<!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;background:#101012"><div id="root" style="height:100dvh;display:flex"></div><script type="module">
        import React from '/node_modules/.vite/deps/react.js';
        import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js';
        import {QueryClient,QueryClientProvider} from '/node_modules/.vite/deps/@tanstack_react-query.js?v=${browserHash}';
        import RefreshRuntime from '/@react-refresh';
        RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;
        import '/src/index.css';
        const {default:Voice}=await import('/src/components/spidr/VoiceChannel.jsx');
        const {default:Badge}=await import('/src/components/spidr/ApexBadge.jsx');
        const client=new QueryClient({defaultOptions:{queries:{retry:false,staleTime:Infinity}}});
        const sessions=[{id:'self',user_id:'host',user_name:'Riley',is_video_on:true},{id:'other',user_id:'guest',user_name:'Morgan',is_video_on:true}];
        client.setQueryData(['voiceSessions','server','channel'],sessions);
        client.setQueryData(['current-user-profile','host'],{});client.setQueryData(['profiles'],[]);
        client.setQueryData(['djSession','channel'],{host_id:'host',host_user_name:'Riley',track_id:'live:test',track_name:'DJ layout test',queue:[],audio_route:'stream'});
        const root=ReactDOM.createRoot(document.getElementById('root'));
        root.render(React.createElement(QueryClientProvider,{client},React.createElement(Voice,{server:{id:'server',name:'Test',owner_id:'host'},channel:{id:'channel',name:'Lounge'},currentUser:{id:'host',username:'Riley'},callId:'test',onLeave(){}})));
        window.mountBadge=()=>root.render(React.createElement(Badge));
      </script></body></html>` });
      if (url.origin === 'http://127.0.0.1:5173') return route.continue();
      let data = {};
      if (url.pathname.includes('now-playing')) data = null;
      if (url.pathname === '/apple-music/search') data = { tracks: [{ id: '12345', name: 'Apple result', artist: 'Test Artist', source: 'apple' }] };
      return route.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }, body: JSON.stringify(data) });
    });
    await page.addInitScript(() => localStorage.setItem('spidr_token', 'qa'));
    for (const [width, height] of [[1440,900],[390,844],[320,740],[844,390]]) {
      await page.setViewportSize({width,height});
      await page.goto('http://127.0.0.1:5173/__qa/voice');
      const rail = page.getByRole('complementary', {name:'Voice participants'});
      await rail.waitFor();
      await page.waitForFunction(() => document.querySelector('.dj-voice-participants video')?.readyState >= 2);
      assert.equal(await rail.locator('video').count(),2);
      assert.equal(await page.locator('.voice-control-dock .lucide-settings').count(),1);
      assert.equal(await page.getByTitle('Camera and voice effects',{exact:true}).count(),1);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),false,'page overflow');
      await page.evaluate(() => { window.savedVideo=document.querySelector('.dj-voice-participants video');window.savedAudio=document.querySelector('audio'); });
      await page.getByRole('button',{name:'Change track',exact:true}).click();
      const dialog=page.getByRole('dialog',{name:'Change track'});
      await dialog.waitFor();
      const railBox=await rail.boundingBox(), modalBox=await dialog.boundingBox();
      assert(railBox.y+railBox.height <= modalBox.y+1 || railBox.x+railBox.width <= modalBox.x+1,'search must not cover participants');
      await page.getByPlaceholder('Search songs, artists\u2026').fill('test');
      await page.getByText('Apple result',{exact:true}).waitFor();
      await page.getByText('Apple result',{exact:true}).scrollIntoViewIfNeeded();
      await page.screenshot({path:path.join(os.tmpdir(),'spidr-dj-voice-search-'+width+'.png')});
      await page.getByRole('button',{name:'Close',exact:true}).click();
      await page.locator('.dj-voice-header').getByRole('button',{name:'Hide DJ deck'}).click();
      assert.equal(await page.evaluate(()=>window.savedVideo===document.querySelector('.dj-voice-participants video') && window.savedAudio===document.querySelector('audio')),true,'toggling deck must preserve media elements');
      await page.locator('.dj-voice-header').getByRole('button',{name:'Open DJ deck'}).click();
      await page.screenshot({path:path.join(os.tmpdir(),'spidr-dj-voice-'+width+'.png')});
    }
    await page.evaluate(()=>window.mountBadge());
    await page.getByAltText('Spidr APEX subscriber').waitFor();
    await page.waitForFunction(()=>document.querySelector('img')?.naturalWidth>0);
    const pixels=await page.getByAltText('Spidr APEX subscriber').evaluate(img=>{
      const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;
      const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);
      return {corner:ctx.getImageData(0,0,1,1).data[3],center:ctx.getImageData(canvas.width/2,canvas.height/2,1,1).data[3]};
    });
    assert.equal(pixels.corner,0,'badge background must be transparent');assert(pixels.center>200,'badge artwork must remain opaque');
    assert.deepEqual(errors,[]);
    console.log('PASS: actual voice channel, persistent cameras/audio, contained search, single cog, transparent badge, and 320/390/844/1440px layouts.');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
