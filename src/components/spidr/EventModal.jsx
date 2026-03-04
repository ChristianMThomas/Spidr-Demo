import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Clock, MapPin, X, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

export default function EventModal({ isOpen, onClose, onCreate, channels = [] }) {
  const [formData, setFormData] = useState({
    title: '',
    event_date: '',
    location: '',
    description: ''
  });

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (!formData.title || !formData.event_date) return;
    onCreate(formData);
    onClose();
    setFormData({ title: '', event_date: '', location: '', description: '' });
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-lg bg-[#0a0a0a] border border-[#FF3333]/30 rounded-2xl overflow-hidden shadow-2xl"
      >
        {/* Header */}
        <div className="bg-[#FF3333]/10 p-6 border-b border-[#FF3333]/20 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <ShieldAlert className="text-[#FF3333]" />
            <h2 className="font-bold text-white tracking-widest uppercase">Establish Sync Node</h2>
          </div>
          <button onClick={onClose}><X className="text-gray-500 hover:text-white" /></button>
        </div>

        {/* Form */}
        <div className="p-6 space-y-4">
          <InputGroup icon={Calendar} label="Event Protocol (Title)">
            <Input 
              type="text" 
              placeholder="e.g. Raid Night / Movie Stream" 
              className="bg-transparent border-0 text-white placeholder-gray-600 focus-visible:ring-0 p-0"
              value={formData.title}
              onChange={(e) => setFormData({...formData, title: e.target.value})}
            />
          </InputGroup>

          <InputGroup icon={Clock} label="T-Minus (Date/Time)">
            <Input 
              type="datetime-local" 
              className="bg-transparent border-0 text-white focus-visible:ring-0 p-0"
              value={formData.event_date}
              onChange={(e) => setFormData({...formData, event_date: e.target.value})}
            />
          </InputGroup>
          
          <InputGroup icon={MapPin} label="Coordinates (Channel)">
            <select 
              className="bg-transparent w-full focus:outline-none text-white text-sm"
              value={formData.location}
              onChange={(e) => setFormData({...formData, location: e.target.value})}
            >
              <option value="">Select channel...</option>
              {channels.map(ch => (
                <option key={ch.id} value={ch.name}>{ch.type === 'voice' ? '🔊' : '#'} {ch.name}</option>
              ))}
            </select>
          </InputGroup>

          <InputGroup label="Briefing (Description)">
            <Textarea 
              placeholder="Enter mission details..." 
              className="bg-transparent border-0 text-white placeholder-gray-600 focus-visible:ring-0 p-0 resize-none"
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
            />
          </InputGroup>

          <Button 
            onClick={handleSubmit}
            className="w-full py-3 bg-[#FF3333] text-white font-bold rounded-xl hover:bg-red-600 transition-all shadow-[0_0_20px_rgba(255,51,51,0.3)] mt-4"
          >
            INITIALIZE EVENT NODE
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

const InputGroup = ({ icon: Icon, label, children }) => (
  <div className="bg-[#111] border border-white/10 rounded-xl p-3 focus-within:border-[#FF3333] transition-colors">
    <div className="flex items-center gap-2 mb-2">
      {Icon && <Icon size={12} className="text-[#FF3333]" />}
      <span className="text-[10px] font-bold text-gray-500 uppercase">{label}</span>
    </div>
    {children}
  </div>
);