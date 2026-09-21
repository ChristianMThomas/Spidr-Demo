import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import DJMatrix from './src/components/spidr/DJMatrix';
import './src/index.css';
const queryClient = new QueryClient();
function Preview() {
  const [paused, setPaused] = useState(false);
  const [volume, setVolume] = useState(80);
  const [narrow, setNarrow] = useState(false);
  return <QueryClientProvider client={queryClient}><div style={{height: '100vh', background: '#070909'}}><button onClick={() => setNarrow(!narrow)} style={{color:'#a0ccae',position:'fixed',top:2,right:8,zIndex:20,fontSize:10}}>Toggle narrow preview</button><div style={{height:'100%', maxWidth: narrow ? 390 : 1024, margin:'auto'}}><DJMatrix channel={{id:'fixture',name:'The listening room'}} currentUser={{id:'host'}} isHost participants={[{user_id:'host',user_name:'Auxtin'},{user_id:'r',user_name:'Riley'},{user_id:'s',user_name:'Sam'}]} djSession={{channel_id:'fixture',host_id:'host',host_user_name:'Auxtin',track_id:'fixture',track_name:'After Hours',track_artist:'The Midnight',preview_url:'fixture',source:'apple',queue:[{qid:'1',track_name:'A Real Hero',track_artist:'College & Electric Youth',added_by:'r',added_by_name:'Riley'},{qid:'2',track_name:'Nightcall',track_artist:'Kavinsky',added_by:'host',added_by_name:'Auxtin'}]}} audio={{audioRoute:'preview',liveAudioActive:false,isPlaying:!paused,status:paused?'paused':'preview',localVolume:volume,setLocalVolume:setVolume,userPaused:paused,togglePause:()=>setPaused(!paused),canControlAudio:true,progressSeconds:12,durationSeconds:30}} /></div></div></QueryClientProvider>;
}
createRoot(document.getElementById('root')).render(<Preview/>);
