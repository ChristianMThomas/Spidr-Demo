import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sparkles } from 'lucide-react';
import { toast } from 'sonner';

export default function ThemeStudio({ open, onClose, currentTheme, onSave }) {
  const [theme, setTheme] = useState(currentTheme || {
    type: 'gradient',
    primaryColor: '#dc2626',
    secondaryColor: '#991b1b',
    backgroundImage: '',
    blur: 0,
    opacity: 90
  });

  const [hasChanges, setHasChanges] = useState(false);

  const updateTheme = (updates) => {
    setTheme(prev => ({ ...prev, ...updates }));
    setHasChanges(true);
  };

  const handleSave = () => {
    onSave(theme);
    setHasChanges(false);
    toast.success('Theme saved!');
    onClose();
  };

  const presetGradients = [
    { name: 'Red Flame', primary: '#dc2626', secondary: '#991b1b' },
    { name: 'Purple Dream', primary: '#9333ea', secondary: '#581c87' },
    { name: 'Blue Ocean', primary: '#2563eb', secondary: '#1e3a8a' },
    { name: 'Green Forest', primary: '#16a34a', secondary: '#14532d' },
    { name: 'Orange Sunset', primary: '#ea580c', secondary: '#9a3412' },
    { name: 'Pink Rose', primary: '#ec4899', secondary: '#9d174d' }
  ];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-zinc-900/95 backdrop-blur-xl border-red-900/30 max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-red-500" />
            Theme Studio
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="gradient" value={theme.type} onValueChange={(v) => updateTheme({ type: v })}>
          <TabsList className="bg-zinc-800 border-red-900/30 mb-4">
            <TabsTrigger value="solid">Solid Color</TabsTrigger>
            <TabsTrigger value="gradient">Gradient</TabsTrigger>
            <TabsTrigger value="image">Custom Image</TabsTrigger>
          </TabsList>

          <TabsContent value="solid" className="space-y-4">
            <div>
              <Label className="text-zinc-300 mb-2 block">Choose Color</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={theme.primaryColor}
                  onChange={(e) => updateTheme({ primaryColor: e.target.value })}
                  className="w-20 h-20 rounded-lg cursor-pointer border-2 border-zinc-700"
                />
                <div className="flex-1">
                  <p className="text-white font-mono">{theme.primaryColor}</p>
                  <p className="text-zinc-500 text-sm">Click to customize</p>
                </div>
              </div>
            </div>

            <div className="h-32 rounded-xl" style={{ backgroundColor: theme.primaryColor }} />
          </TabsContent>

          <TabsContent value="gradient" className="space-y-4">
            <div>
              <Label className="text-zinc-300 mb-2 block">Preset Gradients</Label>
              <div className="grid grid-cols-3 gap-2">
                {presetGradients.map((preset) => (
                  <button
                    key={preset.name}
                    onClick={() => updateTheme({ primaryColor: preset.primary, secondaryColor: preset.secondary })}
                    className="h-16 rounded-lg transition-transform hover:scale-105 border-2 border-transparent hover:border-white"
                    style={{
                      background: `linear-gradient(135deg, ${preset.primary}, ${preset.secondary})`
                    }}
                  >
                    <span className="text-white text-xs font-semibold drop-shadow-lg">{preset.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-zinc-300 mb-2 block">Primary Color</Label>
                <input
                  type="color"
                  value={theme.primaryColor}
                  onChange={(e) => updateTheme({ primaryColor: e.target.value })}
                  className="w-full h-16 rounded-lg cursor-pointer border-2 border-zinc-700"
                />
              </div>
              <div>
                <Label className="text-zinc-300 mb-2 block">Secondary Color</Label>
                <input
                  type="color"
                  value={theme.secondaryColor}
                  onChange={(e) => updateTheme({ secondaryColor: e.target.value })}
                  className="w-full h-16 rounded-lg cursor-pointer border-2 border-zinc-700"
                />
              </div>
            </div>

            <div className="h-32 rounded-xl" style={{
              background: `linear-gradient(135deg, ${theme.primaryColor}, ${theme.secondaryColor})`
            }} />
          </TabsContent>

          <TabsContent value="image" className="space-y-4">
            <div>
              <Label className="text-zinc-300 mb-2 block">Background Image URL</Label>
              <Input
                value={theme.backgroundImage}
                onChange={(e) => updateTheme({ backgroundImage: e.target.value })}
                placeholder="https://example.com/background.jpg"
                className="bg-zinc-800 border-zinc-700 text-white"
              />
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <Label className="text-zinc-300">Blur Strength</Label>
                <span className="text-zinc-400 text-sm">{theme.blur}px</span>
              </div>
              <Slider
                value={[theme.blur]}
                onValueChange={([v]) => updateTheme({ blur: v })}
                max={20}
                className="w-full"
              />
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <Label className="text-zinc-300">Overlay Opacity</Label>
                <span className="text-zinc-400 text-sm">{theme.opacity}%</span>
              </div>
              <Slider
                value={[theme.opacity]}
                onValueChange={([v]) => updateTheme({ opacity: v })}
                max={100}
                className="w-full"
              />
            </div>

            {theme.backgroundImage && (
              <div className="h-32 rounded-xl relative overflow-hidden">
                <img
                  src={theme.backgroundImage}
                  alt="Preview"
                  className="w-full h-full object-cover"
                  style={{ filter: `blur(${theme.blur}px)` }}
                />
                <div 
                  className="absolute inset-0 bg-black"
                  style={{ opacity: (100 - theme.opacity) / 100 }}
                />
              </div>
            )}
          </TabsContent>
        </Tabs>

        <div className="flex justify-between items-center pt-4 border-t border-zinc-800">
          {hasChanges && (
            <p className="text-yellow-500 text-sm flex items-center gap-2">
              <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
              Unsaved changes
            </p>
          )}
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} className="bg-red-600 hover:bg-red-700">
              Save Theme
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}