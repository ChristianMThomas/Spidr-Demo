import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { entities, auth, integrations } from '@/api/apiClient';
import { useAuth } from '@/lib/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { User, Palette, Bell, Shield, LogOut, Upload, Sparkles, Mic, Video, Volume2, Zap, ShieldAlert, Ghost, LayoutPanelLeft } from 'lucide-react';
import ApexStore from './ApexStore';
import SpiderLogo from './SpiderLogo';
import { Slider } from '@/components/ui/slider';
import ThemeStudio from './ThemeStudio';
import ImageCropper from './ImageCropper';
import AVLab from './AVLab';
import NeuralConfig from './NeuralConfig';
import SecurityMatrix from './SecurityMatrix';
import SpidrProtocolSettings from './SpidrProtocolSettings';
import TelemetryDeck from './TelemetryDeck';
import ApexVisuals from './ApexVisuals';
import { USERNAME_FONTS, USERNAME_WEIGHTS, USERNAME_STYLES, USERNAME_EFFECTS, buildUsernameStyle } from '@/lib/usernameStyle';
import { toast } from 'sonner';

export default function SettingsPanel({ currentUser, appTheme, onThemeChange }) {
  const { logout } = useAuth();
  const queryClient = useQueryClient();
  
  const { data: profile } = useQuery({
    queryKey: ['userProfile', currentUser?.id],
    queryFn: async () => {
      const profiles = await entities.UserProfile.filter({ user_id: currentUser?.id });
      return profiles[0];
    },
    enabled: !!currentUser?.id
  });

  const [formData, setFormData] = useState({
    display_name: '',
    bio: '',
    avatar_url: '',
    banner_url: '',
    status: 'online',
    custom_status: '',
    accent_color: '#dc2626',
    profile_gradient: '',
    profile_pattern: 'none',
    profile_frame: 'default',
    username_font: 'default',
    username_weight: 'bold',
    username_style: 'normal',
    username_color: '',
    username_effect: 'none',
    apex_features: {}

  });

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showThemeStudio, setShowThemeStudio] = useState(false);
  const [cropperConfig, setCropperConfig] = useState({ open: false, src: null, type: null });
  const [showApexStore, setShowApexStore] = useState(false);

  useEffect(() => {
    if (profile) {
      setFormData({
        display_name: profile.display_name || currentUser?.full_name || '',
        bio: profile.bio || '',
        avatar_url: profile.avatar_url || '',
        banner_url: profile.banner_url || '',
        status: profile.status || 'online',
        custom_status: profile.custom_status || '',
        accent_color: profile.accent_color || '#dc2626',
        profile_gradient: profile.profile_gradient || '',
        profile_pattern: profile.profile_pattern || 'none',
        profile_frame: profile.profile_frame || 'default',
        username_font: profile.username_font || 'default',
        username_weight: profile.username_weight || 'bold',
        username_style: profile.username_style || 'normal',
        username_color: profile.username_color || '',
        username_effect: profile.username_effect || 'none',
        apex_features: {
          thread_skin: 'default',
          entry_protocol: 'none',
          show_aura: false,
          custom_bg_url: '',
          custom_bg_opacity: 40,
          widgets: [],
          ...(profile.apex_features || {})
        }
      });
      setHasUnsavedChanges(false);
    }
  }, [profile, currentUser]);

  const updateFormData = (updates) => {
    setFormData(prev => ({ ...prev, ...updates }));
    setHasUnsavedChanges(true);
  };

  const updateProfileMutation = useMutation({
    mutationFn: async (data) => {
      if (profile) {
        return entities.UserProfile.update(profile.id, data);
      } else {
        return entities.UserProfile.create({ ...data, user_id: currentUser?.id });
      }
    },
    onSuccess: () => {
      // ['userProfile', userId] is the canonical view-side key — invalidate it
      // explicitly, then the broader 'userProfile' prefix as a safety net so
      // every cached profile view refreshes.
      queryClient.invalidateQueries({ queryKey: ['userProfile', currentUser?.id] });
      queryClient.invalidateQueries({ queryKey: ['userProfile'] });
      queryClient.invalidateQueries({ queryKey: ['current-user-profile'] });
      queryClient.invalidateQueries({ queryKey: ['profiles-for-chat'] });
      toast.success('Profile updated!');
    }
  });

  const handleSave = () => {
    updateProfileMutation.mutate(formData);
    setHasUnsavedChanges(false);
  };

  const handleFileUpload = async (e, field) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // GIFs: skip the JPEG cropper (it destroys animation) — upload directly
    if (file.type === 'image/gif') {
      try {
        toast.loading('Uploading GIF…', { id: 'gif-upload' });
        const { url } = await integrations.Core.UploadFile({ file });
        updateFormData({ [field]: url });
        // Auto-save immediately so the change persists
        updateProfileMutation.mutate({ ...formData, [field]: url });
        toast.success('GIF uploaded!', { id: 'gif-upload' });
      } catch {
        toast.error('GIF upload failed', { id: 'gif-upload' });
      }
      return;
    }

    // Images: open the cropper
    const reader = new FileReader();
    reader.onload = () => {
      setCropperConfig({
        open: true,
        src: reader.result,
        type: field,
        aspectRatio: field === 'avatar_url' ? 1 : 16 / 9
      });
    };
    reader.readAsDataURL(file);
  };

  const handleCropComplete = async (url) => {
    updateFormData({ [cropperConfig.type]: url });
    // Auto-save immediately after crop so the image actually persists
    updateProfileMutation.mutate({ ...formData, [cropperConfig.type]: url });
    setCropperConfig({ open: false, src: null, type: null });
  };

  return (
    <div className="flex-1 flex flex-col bg-zinc-900 relative min-h-0">
      <Tabs defaultValue="profile" className="flex flex-col flex-1 min-h-0">
        {/* Top Tab Navigation */}
        <div className="bg-zinc-800/50 border-b border-red-900/20 px-4 py-3 overflow-x-auto">
          <div className="flex items-center gap-4 min-w-max">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider shrink-0">User Settings</p>
            <TabsList className="flex bg-transparent gap-1">
              <TabsTrigger value="profile" className="flex items-center gap-2 data-[state=active]:bg-red-600/20 data-[state=active]:text-white px-3 py-2 text-sm">
                <User className="w-4 h-4" /> <span className="hidden sm:inline">Profile</span>
              </TabsTrigger>
              <TabsTrigger value="appearance" className="flex items-center gap-2 data-[state=active]:bg-red-600/20 data-[state=active]:text-white px-3 py-2 text-sm">
                <Palette className="w-4 h-4" /> <span className="hidden sm:inline">Appearance</span>
              </TabsTrigger>
              <TabsTrigger value="notifications" className="flex items-center gap-2 data-[state=active]:bg-red-600/20 data-[state=active]:text-white px-3 py-2 text-sm">
                <Bell className="w-4 h-4" /> <span className="hidden sm:inline">Notifications</span>
              </TabsTrigger>
              <TabsTrigger value="privacy" className="flex items-center gap-2 data-[state=active]:bg-red-600/20 data-[state=active]:text-white px-3 py-2 text-sm">
                <Shield className="w-4 h-4" /> <span className="hidden sm:inline">Privacy</span>
              </TabsTrigger>
              <TabsTrigger value="voice" className="flex items-center gap-2 data-[state=active]:bg-red-600/20 data-[state=active]:text-white px-3 py-2 text-sm">
                <Mic className="w-4 h-4" /> <span className="hidden sm:inline">Voice</span>
              </TabsTrigger>
              <TabsTrigger value="avlab" className="flex items-center gap-2 data-[state=active]:bg-red-600/20 data-[state=active]:text-white px-3 py-2 text-sm">
                <Video className="w-4 h-4" /> <span className="hidden sm:inline">A/V Lab</span>
              </TabsTrigger>
              <TabsTrigger value="connections" className="flex items-center gap-2 data-[state=active]:bg-red-600/20 data-[state=active]:text-white px-3 py-2 text-sm">
                <Zap className="w-4 h-4" /> <span className="hidden sm:inline">Neural</span>
              </TabsTrigger>
              <TabsTrigger value="security" className="flex items-center gap-2 data-[state=active]:bg-red-600/20 data-[state=active]:text-white px-3 py-2 text-sm">
                <ShieldAlert className="w-4 h-4" /> <span className="hidden sm:inline">Security</span>
              </TabsTrigger>
              <TabsTrigger value="protocol" className="flex items-center gap-2 data-[state=active]:bg-red-600/20 data-[state=active]:text-white px-3 py-2 text-sm">
                <Ghost className="w-4 h-4" /> <span className="hidden sm:inline">Protocol</span>
              </TabsTrigger>
              <TabsTrigger value="widgets" className="flex items-center gap-2 data-[state=active]:bg-blue-600/20 data-[state=active]:text-blue-400 px-3 py-2 text-sm">
                <LayoutPanelLeft className="w-4 h-4" /> <span className="hidden sm:inline">Widgets</span>
              </TabsTrigger>
              {profile?.apex_tier === 'apex' && (
                <TabsTrigger value="apex" className="flex items-center gap-2 data-[state=active]:bg-yellow-500/20 data-[state=active]:text-yellow-500 px-3 py-2 text-sm">
                  <SpiderLogo size={16} /> <span className="hidden sm:inline">APEX</span>
                </TabsTrigger>
              )}
            </TabsList>
            <div className="flex gap-2 ml-auto shrink-0">
              <Button 
                variant="ghost" 
                size="sm"
                className="text-yellow-400 hover:text-yellow-300 hover:bg-yellow-900/20"
                onClick={() => setShowApexStore(true)}
              >
                <SpiderLogo size={14} /> <span className="hidden sm:inline ml-1">APEX</span>
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                onClick={() => logout()}
              >
                <LogOut className="w-4 h-4" /> <span className="hidden sm:inline ml-1">Logout</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Settings Content */}
        <div className="flex-1 overflow-y-auto pb-32">
          <TabsContent value="profile" className="p-6 m-0">
            <h2 className="text-2xl font-bold text-white mb-6">My Profile</h2>
            
            {/* Profile Preview */}
            <div className="bg-zinc-800 rounded-2xl overflow-hidden mb-6">
              {/* Banner */}
              <div className="h-36 relative bg-gradient-to-r from-red-900 to-red-700 group">
                {formData.banner_url && (
                  <img src={formData.banner_url} alt="Banner" className="w-full h-full object-cover" />
                )}
                <label className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer gap-2">
                  <input type="file" accept="image/*,.gif,image/gif" className="hidden" onChange={(e) => handleFileUpload(e, 'banner_url')} />
                  <Upload className="w-7 h-7 text-white" />
                  <span className="text-white text-xs font-bold">UPLOAD BANNER / GIF</span>
                </label>
              </div>
              
              {/* Avatar & Info */}
              <div className="px-6 pb-6">
                <div className="relative -mt-12 mb-4">
                  <div className="w-24 h-24 rounded-full border-4 border-zinc-800 overflow-hidden bg-red-600 flex items-center justify-center relative">
                    {formData.avatar_url ? (
                      <img src={formData.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-white text-2xl font-bold">{formData.display_name?.charAt(0)?.toUpperCase() || 'U'}</span>
                    )}
                  </div>
                  <label className="absolute inset-0 w-24 h-24 flex items-center justify-center bg-black/60 rounded-full opacity-0 hover:opacity-100 transition-opacity cursor-pointer">
                    <input type="file" accept="image/*,.gif,image/gif" className="hidden" onChange={(e) => handleFileUpload(e, 'avatar_url')} />
                    <div className="flex flex-col items-center gap-1">
                      <Upload className="w-5 h-5 text-white" />
                      <span className="text-white text-[9px] font-bold">UPLOAD</span>
                    </div>
                  </label>
                </div>
                
                <h3 className="text-xl font-bold text-white">{formData.display_name || 'Username'}</h3>
                <p className="text-zinc-400 text-sm font-mono">
                  @{currentUser?.username || 'username'}
                  {(profile?.discriminator || currentUser?.discriminator) && (
                    <span className="text-zinc-500">#{profile?.discriminator || currentUser?.discriminator}</span>
                  )}
                </p>
                {formData.bio && <p className="text-zinc-300 mt-2">{formData.bio}</p>}
              </div>
            </div>
            
            {/* Form */}
            <div className="space-y-4 max-w-lg">
              <div>
                <Label className="text-zinc-300">Display Name</Label>
                <Input
                  value={formData.display_name}
                  onChange={(e) => updateFormData({ display_name: e.target.value })}
                  className="bg-zinc-800 border-zinc-700 text-white mt-1"
                />
              </div>
              
              <div>
                <Label className="text-zinc-300">Bio</Label>
                <Textarea
                  value={formData.bio}
                  onChange={(e) => updateFormData({ bio: e.target.value })}
                  className="bg-zinc-800 border-zinc-700 text-white mt-1"
                  rows={3}
                />
              </div>
              
              <div>
                <Label className="text-zinc-300">Status</Label>
                <Select value={formData.status} onValueChange={(v) => updateFormData({ status: v })}>
                  <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-700">
                    <SelectItem value="online">🟢 Online</SelectItem>
                    <SelectItem value="idle">🟡 Idle</SelectItem>
                    <SelectItem value="dnd">🔴 Do Not Disturb</SelectItem>
                    <SelectItem value="offline">⚫ Invisible</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label className="text-zinc-300">Custom Status</Label>
                <Input
                  value={formData.custom_status}
                  onChange={(e) => updateFormData({ custom_status: e.target.value })}
                  placeholder="What's on your mind?"
                  className="bg-zinc-800 border-zinc-700 text-white mt-1"
                />
              </div>
              
              <div>
                <Label className="text-zinc-300 flex items-center gap-2">
                  Avatar URL <span className="text-xs text-green-400 font-bold">✓ GIF supported</span>
                </Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    value={formData.avatar_url}
                    onChange={(e) => updateFormData({ avatar_url: e.target.value })}
                    placeholder="https://example.com/avatar.gif or paste GIF link"
                    className="bg-zinc-800 border-zinc-700 text-white flex-1"
                  />
                  {formData.avatar_url && (
                    <img src={formData.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover border border-zinc-600" onError={e => e.target.style.display='none'} />
                  )}
                </div>
              </div>
              
              <div>
                <Label className="text-zinc-300 flex items-center gap-2">
                  Banner URL <span className="text-xs text-green-400 font-bold">✓ GIF supported</span>
                </Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    value={formData.banner_url}
                    onChange={(e) => updateFormData({ banner_url: e.target.value })}
                    placeholder="https://example.com/banner.gif or paste GIF link"
                    className="bg-zinc-800 border-zinc-700 text-white flex-1"
                  />
                  {formData.banner_url && (
                    <img src={formData.banner_url} alt="" className="w-16 h-10 rounded object-cover border border-zinc-600" onError={e => e.target.style.display='none'} />
                  )}
                </div>
              </div>
              
              <Button 
                onClick={handleSave} 
                className="bg-red-600 hover:bg-red-700 mt-4"
                disabled={updateProfileMutation.isPending}
              >
                {updateProfileMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="appearance" className="p-6 m-0">
            <h2 className="text-2xl font-bold text-white mb-6">Appearance</h2>
            <div className="space-y-6 max-w-lg">
              {/* Floating dock preferences */}
              <DockPreferencesCard />

              <div className="bg-zinc-800/50 backdrop-blur-xl rounded-2xl p-6 border border-red-900/20">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-red-500" />
                  Theme Studio
                </h3>
                <p className="text-zinc-400 text-sm mb-4">
                  Customize your app with colors, gradients, or images
                </p>
                <Button onClick={() => setShowThemeStudio(true)} className="bg-red-600 hover:bg-red-700 w-full">
                  Open Theme Studio
                </Button>
              </div>

              <div className="bg-zinc-800/50 backdrop-blur-xl rounded-2xl p-6 border border-red-900/20">
                <h3 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-red-500" />
                  Username Style
                </h3>
                <p className="text-zinc-400 text-xs mb-4">
                  Customize how your name appears across Spidr — no APEX needed.
                </p>

                {/* Live Preview */}
                <div className="bg-black/40 border border-white/10 rounded-xl px-4 py-5 mb-5 flex items-center justify-center">
                  <span
                    className="text-3xl tracking-tight leading-none"
                    style={buildUsernameStyle(formData, { fallbackColor: '#FF3333' })}
                  >
                    {formData.display_name || 'Your Name'}
                  </span>
                </div>

                <div className="space-y-5">
                  {/* Font Family */}
                  <div>
                    <Label className="text-zinc-300 mb-2 block text-xs uppercase tracking-wider font-bold">Font Family</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {USERNAME_FONTS.map(font => (
                        <button
                          key={font.value}
                          type="button"
                          onClick={() => updateFormData({ username_font: font.value })}
                          className={`px-3 py-3 rounded-lg text-sm transition-all border ${
                            formData.username_font === font.value
                              ? 'bg-red-600/15 border-red-500/50 text-white ring-1 ring-red-500/30'
                              : 'bg-zinc-900/50 border-white/5 text-zinc-400 hover:text-white hover:border-white/15'
                          }`}
                          style={{ fontFamily: font.value !== 'default' ? font.css : undefined }}
                        >
                          {font.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Weight */}
                  <div>
                    <Label className="text-zinc-300 mb-2 block text-xs uppercase tracking-wider font-bold">Weight</Label>
                    <div className="grid grid-cols-4 gap-2">
                      {USERNAME_WEIGHTS.map(w => (
                        <button
                          key={w.value}
                          type="button"
                          onClick={() => updateFormData({ username_weight: w.value })}
                          className={`px-3 py-2 rounded-lg text-sm transition-all border ${
                            formData.username_weight === w.value
                              ? 'bg-red-600/15 border-red-500/50 text-white ring-1 ring-red-500/30'
                              : 'bg-zinc-900/50 border-white/5 text-zinc-400 hover:text-white hover:border-white/15'
                          }`}
                          style={{ fontWeight: w.css }}
                        >
                          {w.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Style */}
                  <div>
                    <Label className="text-zinc-300 mb-2 block text-xs uppercase tracking-wider font-bold">Style</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {USERNAME_STYLES.map(s => (
                        <button
                          key={s.value}
                          type="button"
                          onClick={() => updateFormData({ username_style: s.value })}
                          className={`px-3 py-2 rounded-lg text-sm transition-all border ${
                            formData.username_style === s.value
                              ? 'bg-red-600/15 border-red-500/50 text-white ring-1 ring-red-500/30'
                              : 'bg-zinc-900/50 border-white/5 text-zinc-400 hover:text-white hover:border-white/15'
                          }`}
                          style={{ fontStyle: s.value === 'italic' ? 'italic' : 'normal' }}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Color — separate from accent_color so users can have a distinct username color */}
                  <div>
                    <Label className="text-zinc-300 mb-2 block text-xs uppercase tracking-wider font-bold">
                      Name Color <span className="text-zinc-500 normal-case text-[10px] font-normal ml-1">(leave empty to use accent color)</span>
                    </Label>
                    <div className="flex flex-wrap gap-2 items-center">
                      {['', '#ffffff', '#FF3333', '#a855f7', '#3b82f6', '#10b981', '#eab308', '#ec4899', '#f97316', '#06b6d4'].map(color => (
                        <button
                          key={color || 'unset'}
                          type="button"
                          onClick={() => updateFormData({ username_color: color })}
                          className={`w-10 h-10 rounded-lg transition-transform hover:scale-110 flex items-center justify-center ${
                            formData.username_color === color ? 'ring-2 ring-white scale-110' : ''
                          }`}
                          style={{
                            backgroundColor: color || 'transparent',
                            border: color ? '1px solid rgba(255,255,255,0.1)' : '1px dashed rgba(255,255,255,0.2)',
                          }}
                          title={color || 'Use accent color'}
                        >
                          {!color && <span className="text-[10px] text-zinc-500 font-bold">AUTO</span>}
                        </button>
                      ))}
                      <div className="flex items-center gap-2 ml-2">
                        <input
                          type="color"
                          value={formData.username_color || '#ffffff'}
                          onChange={(e) => updateFormData({ username_color: e.target.value })}
                          className="w-10 h-10 rounded-lg cursor-pointer bg-transparent"
                        />
                        <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Custom</span>
                      </div>
                    </div>
                  </div>

                  {/* Effect — animated visual effects applied on top of color */}
                  <div>
                    <Label className="text-zinc-300 mb-2 block text-xs uppercase tracking-wider font-bold">
                      Effect <span className="text-zinc-500 normal-case text-[10px] font-normal ml-1">(animated effects don't apply to server role names)</span>
                    </Label>
                    <div className="grid grid-cols-3 gap-2">
                      {USERNAME_EFFECTS.map(eff => (
                        <button
                          key={eff.value}
                          type="button"
                          onClick={() => updateFormData({ username_effect: eff.value })}
                          className={`px-3 py-3 rounded-lg text-sm transition-all border relative overflow-hidden ${
                            formData.username_effect === eff.value
                              ? 'bg-red-600/15 border-red-500/50 text-white ring-1 ring-red-500/30'
                              : 'bg-zinc-900/50 border-white/5 text-zinc-400 hover:text-white hover:border-white/15'
                          }`}
                        >
                          {/* Render the label IN the effect so users can preview */}
                          <span style={buildUsernameStyle(
                            { ...formData, username_effect: eff.value },
                            { fallbackColor: '#FF3333' }
                          )}>
                            {eff.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <Button
                  onClick={handleSave}
                  disabled={updateProfileMutation.isPending || !hasUnsavedChanges}
                  className="bg-red-600 hover:bg-red-700 w-full mt-5 disabled:opacity-40"
                >
                  {updateProfileMutation.isPending ? 'Saving…' : 'Save Username Style'}
                </Button>
              </div>

              <div className="bg-zinc-800/50 backdrop-blur-xl rounded-2xl p-6 border border-red-900/20">
                <h3 className="text-lg font-semibold text-white mb-4">Profile Customization</h3>
                
                <div className="space-y-6">
                  {/* Accent Color */}
                  <div>
                    <Label className="text-zinc-300 mb-3 block">Accent Color</Label>
                    <div className="flex gap-3 items-center flex-wrap">
                      {['#dc2626', '#ea580c', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e', '#14b8a6', '#f59e0b'].map(color => (
                        <button
                          key={color}
                          onClick={() => updateFormData({ accent_color: color })}
                          className={`w-12 h-12 rounded-full transition-transform hover:scale-110 ${
                            formData.accent_color === color ? 'ring-4 ring-white scale-110' : ''
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={formData.accent_color}
                          onChange={(e) => updateFormData({ accent_color: e.target.value })}
                          className="w-12 h-12 rounded-full cursor-pointer"
                        />
                        <span className="text-xs text-zinc-400">Custom</span>
                      </div>
                    </div>
                  </div>

                  {/* Gradient Background */}
                  <div>
                    <Label className="text-zinc-300 mb-3 block">Profile Gradient (optional)</Label>
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      {[
                        { name: 'None', value: '' },
                        { name: 'Sunset', value: 'linear-gradient(135deg, #ff6b6b, #feca57)' },
                        { name: 'Ocean', value: 'linear-gradient(135deg, #0984e3, #00cec9)' },
                        { name: 'Purple Haze', value: 'linear-gradient(135deg, #a29bfe, #fd79a8)' },
                        { name: 'Cyberpunk', value: 'linear-gradient(135deg, #ff006e, #8338ec, #3a86ff)' },
                        { name: 'Forest', value: 'linear-gradient(135deg, #00b894, #00cec9)' }
                      ].map(grad => (
                        <button
                          key={grad.name}
                          onClick={() => updateFormData({ profile_gradient: grad.value })}
                          className={`h-16 rounded-lg transition-transform hover:scale-105 ${
                            formData.profile_gradient === grad.value ? 'ring-4 ring-white scale-105' : ''
                          }`}
                          style={{ background: grad.value || '#18181b' }}
                        >
                          <span className="text-xs text-white font-semibold drop-shadow-lg">{grad.name}</span>
                        </button>
                      ))}
                    </div>
                    <Input
                      value={formData.profile_gradient}
                      onChange={(e) => updateFormData({ profile_gradient: e.target.value })}
                      placeholder="linear-gradient(135deg, #color1, #color2)"
                      className="bg-zinc-700 border-zinc-600 text-white text-xs"
                    />
                  </div>

                  {/* Frame Style */}
                  <div>
                    <Label className="text-zinc-300 mb-3 block">Profile Frame</Label>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { name: 'Default', value: 'default' },
                        { name: 'Neon Glow', value: 'neon' },
                        { name: 'Double', value: 'double' },
                        { name: 'Sharp', value: 'sharp' }
                      ].map(frame => (
                        <button
                          key={frame.value}
                          onClick={() => updateFormData({ profile_frame: frame.value })}
                          className={`px-3 py-2 rounded-lg bg-zinc-700 text-white text-xs transition-all hover:bg-zinc-600 ${
                            formData.profile_frame === frame.value ? 'ring-2 ring-red-500' : ''
                          }`}
                        >
                          {frame.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <ThemeStudio
              open={showThemeStudio}
              onClose={() => setShowThemeStudio(false)}
              currentTheme={appTheme}
              onSave={onThemeChange}
            />
          </TabsContent>

          <TabsContent value="notifications" className="p-6 m-0">
            <h2 className="text-2xl font-bold text-white mb-6">Notifications & Sounds</h2>
            <div className="space-y-6 max-w-lg">
              {/* Sound Settings */}
              <div className="bg-zinc-800 rounded-xl p-4">
                <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                  <Volume2 className="w-5 h-5 text-red-500" /> Sound Settings
                </h3>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white font-medium">Master Sound</p>
                      <p className="text-zinc-500 text-sm">Enable all sound effects</p>
                    </div>
                    <Switch defaultChecked />
                  </div>

                  <div>
                    <div className="flex justify-between mb-2">
                      <Label className="text-zinc-400">Sound Volume</Label>
                      <span className="text-zinc-400 text-sm">80%</span>
                    </div>
                    <Slider defaultValue={[80]} max={100} className="w-full" />
                  </div>

                  <div className="border-t border-zinc-700 pt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white text-sm">Message Sent</p>
                        <p className="text-zinc-500 text-xs">Play sound when sending message</p>
                      </div>
                      <Switch defaultChecked />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white text-sm">Message Received</p>
                        <p className="text-zinc-500 text-xs">Play sound for incoming messages</p>
                      </div>
                      <Switch defaultChecked />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white text-sm">User Join/Leave</p>
                        <p className="text-zinc-500 text-xs">Voice channel join/leave sounds</p>
                      </div>
                      <Switch defaultChecked />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white text-sm">UI Interactions</p>
                        <p className="text-zinc-500 text-xs">Hover and click sound effects</p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                  </div>
                </div>
              </div>

              {/* Notification Settings */}
              <div className="bg-zinc-800 rounded-xl p-4">
                <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                  <Bell className="w-5 h-5 text-red-500" /> Desktop Notifications
                </h3>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white font-medium">Enable Notifications</p>
                      <p className="text-zinc-500 text-sm">Get desktop notifications</p>
                    </div>
                    <Switch defaultChecked />
                  </div>

                  <div className="border-t border-zinc-700 pt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white text-sm">Direct Messages</p>
                        <p className="text-zinc-500 text-xs">Notify for all DMs</p>
                      </div>
                      <Switch defaultChecked />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white text-sm">Server Messages</p>
                        <p className="text-zinc-500 text-xs">Notify for @mentions only</p>
                      </div>
                      <Switch />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white text-sm">Friend Requests</p>
                        <p className="text-zinc-500 text-xs">New friend request notifications</p>
                      </div>
                      <Switch defaultChecked />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white text-sm">Voice Calls</p>
                        <p className="text-zinc-500 text-xs">Incoming call notifications</p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                  </div>
                </div>
              </div>

              {/* Do Not Disturb */}
              <div className="bg-zinc-800 rounded-xl p-4">
                <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-red-500" /> Do Not Disturb
                </h3>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white font-medium">Suppress All Notifications</p>
                      <p className="text-zinc-500 text-sm">When status is DND</p>
                    </div>
                    <Switch defaultChecked />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white text-sm">Allow Urgent DMs</p>
                      <p className="text-zinc-500 text-xs">Show notifications from close friends</p>
                    </div>
                    <Switch />
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="privacy" className="p-6 m-0">
            <h2 className="text-2xl font-bold text-white mb-6">Privacy & Safety</h2>
            <div className="space-y-4 max-w-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-medium">Allow Direct Messages</p>
                  <p className="text-zinc-500 text-sm">Allow others to send you direct messages</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-medium">Show Online Status</p>
                  <p className="text-zinc-500 text-sm">Let others see when you're online</p>
                </div>
                <Switch defaultChecked />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="voice" className="p-6 m-0">
            <h2 className="text-2xl font-bold text-white mb-6">Voice & Video</h2>
            <div className="space-y-6 max-w-lg">
              <div className="bg-zinc-800 rounded-xl p-4">
                <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                  <Mic className="w-5 h-5 text-red-500" /> Input Device
                </h3>
                <Select defaultValue="default">
                  <SelectTrigger className="bg-zinc-700 border-zinc-600 text-white">
                    <SelectValue placeholder="Select microphone" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-700">
                    <SelectItem value="default">Default Microphone</SelectItem>
                    <SelectItem value="headset">Headset Microphone</SelectItem>
                    <SelectItem value="webcam">Webcam Microphone</SelectItem>
                  </SelectContent>
                </Select>
                <div className="mt-4">
                  <div className="flex justify-between mb-2">
                    <Label className="text-zinc-400">Input Volume</Label>
                    <span className="text-zinc-400 text-sm">100%</span>
                  </div>
                  <Slider defaultValue={[100]} max={100} className="w-full" />
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <div>
                    <p className="text-white font-medium">Noise Suppression</p>
                    <p className="text-zinc-500 text-sm">Reduce background noise</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <div>
                    <p className="text-white font-medium">Echo Cancellation</p>
                    <p className="text-zinc-500 text-sm">Prevent echo in calls</p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </div>

              <div className="bg-zinc-800 rounded-xl p-4">
                <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                  <Volume2 className="w-5 h-5 text-red-500" /> Output Device
                </h3>
                <Select defaultValue="default">
                  <SelectTrigger className="bg-zinc-700 border-zinc-600 text-white">
                    <SelectValue placeholder="Select speakers" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-700">
                    <SelectItem value="default">Default Speakers</SelectItem>
                    <SelectItem value="headphones">Headphones</SelectItem>
                    <SelectItem value="monitor">Monitor Speakers</SelectItem>
                  </SelectContent>
                </Select>
                <div className="mt-4">
                  <div className="flex justify-between mb-2">
                    <Label className="text-zinc-400">Output Volume</Label>
                    <span className="text-zinc-400 text-sm">100%</span>
                  </div>
                  <Slider defaultValue={[100]} max={100} className="w-full" />
                </div>
              </div>

              <div className="bg-zinc-800 rounded-xl p-4">
                <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                  <Video className="w-5 h-5 text-red-500" /> Video Settings
                </h3>
                <Select defaultValue="default">
                  <SelectTrigger className="bg-zinc-700 border-zinc-600 text-white">
                    <SelectValue placeholder="Select camera" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-700">
                    <SelectItem value="default">Default Camera</SelectItem>
                    <SelectItem value="webcam">USB Webcam</SelectItem>
                    <SelectItem value="virtual">Virtual Camera</SelectItem>
                  </SelectContent>
                </Select>
                <div className="mt-4 p-4 bg-zinc-900 rounded-lg flex items-center justify-center">
                  <div className="text-center">
                    <Video className="w-12 h-12 text-zinc-600 mx-auto mb-2" />
                    <p className="text-zinc-500 text-sm">Camera preview</p>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <div>
                    <p className="text-white font-medium">Always show video preview</p>
                    <p className="text-zinc-500 text-sm">Show preview before joining</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <div>
                    <p className="text-white font-medium">Mirror video</p>
                    <p className="text-zinc-500 text-sm">Flip your video horizontally</p>
                  </div>
                  <Switch />
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="avlab" className="p-0 m-0 h-full">
            <AVLab />
          </TabsContent>

          <TabsContent value="connections" className="p-0 m-0 h-full">
            <NeuralConfig currentUser={currentUser} />
          </TabsContent>

          <TabsContent value="security" className="p-0 m-0 h-full">
            <SecurityMatrix currentUser={currentUser} />
          </TabsContent>

          <TabsContent value="protocol" className="p-6 m-0">
            <h2 className="text-2xl font-bold text-white mb-6">Spidr Protocol</h2>
            <div className="space-y-6 max-w-lg">
              <SpidrProtocolSettings />
            </div>
          </TabsContent>

          <TabsContent value="widgets" className="p-0 m-0 h-full">
            <TelemetryDeck currentUser={currentUser} />
          </TabsContent>

          <TabsContent value="apex" className="p-6 m-0">
            <div className="max-w-3xl space-y-8">
              {/* Apex Visuals — Background + Chroma Name */}
              <ApexVisuals formData={formData} updateFormData={updateFormData} />

              <div className="h-[1px] bg-white/5 w-full" />

              {/* Thread Skins */}
              <div className="bg-zinc-800/50 backdrop-blur-xl rounded-2xl p-6 border border-yellow-500/20">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-yellow-500" />
                  Thread Skins
                </h3>
                <p className="text-zinc-400 text-sm mb-4">
                  Customize the silk threads in voice calls
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { name: 'Default', value: 'default', gradient: 'bg-[#333]' },
                    { name: 'RGB Flow', value: 'rgb', gradient: 'bg-gradient-to-r from-red-500 via-green-500 to-blue-500' },
                    { name: 'Venom', value: 'venom', gradient: 'bg-gradient-to-r from-purple-600 to-black' },
                    { name: 'Glitch', value: 'glitch', gradient: 'bg-[#00ff00]' },
                    { name: 'Invisible', value: 'invisible', gradient: 'bg-transparent border border-white/20' }
                  ].map(skin => (
                    <button
                      key={skin.value}
                      onClick={() => updateFormData({ 
                        apex_features: { 
                          ...formData.apex_features, 
                          thread_skin: skin.value 
                        } 
                      })}
                      className={`px-4 py-3 rounded-lg text-white text-sm transition-all hover:scale-105 ${
                        formData.apex_features?.thread_skin === skin.value 
                          ? 'ring-2 ring-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.5)]' 
                          : 'opacity-70'
                      } ${skin.gradient}`}
                    >
                      {skin.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Entry Protocols */}
              <div className="bg-zinc-800/50 backdrop-blur-xl rounded-2xl p-6 border border-yellow-500/20">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-yellow-500" />
                  Entry Protocol
                </h3>
                <p className="text-zinc-400 text-sm mb-4">
                  Your entrance animation when joining voice
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { name: 'None', value: 'none' },
                    { name: 'Thunder Strike', value: 'thunder' },
                    { name: 'Ripple Wave', value: 'ripple' },
                    { name: 'Digital Glitch', value: 'glitch' }
                  ].map(protocol => (
                    <button
                      key={protocol.value}
                      onClick={() => updateFormData({ 
                        apex_features: { 
                          ...formData.apex_features, 
                          entry_protocol: protocol.value 
                        } 
                      })}
                      className={`px-4 py-3 rounded-lg bg-zinc-700 text-white text-sm transition-all hover:bg-zinc-600 ${
                        formData.apex_features?.entry_protocol === protocol.value 
                          ? 'ring-2 ring-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.5)]' 
                          : ''
                      }`}
                    >
                      {protocol.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Aura Display */}
              <div className="bg-zinc-800/50 backdrop-blur-xl rounded-2xl p-6 border border-yellow-500/20">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Palette className="w-5 h-5 text-yellow-500" />
                  Aura Display
                </h3>
                <p className="text-zinc-400 text-sm mb-4">
                  Show your custom accent colors in member lists
                </p>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.apex_features?.show_aura || false}
                    onChange={(e) => updateFormData({ 
                      apex_features: { 
                        ...formData.apex_features, 
                        show_aura: e.target.checked 
                      } 
                    })}
                    className="w-5 h-5 rounded bg-zinc-700 border-yellow-500/30 checked:bg-yellow-500"
                  />
                  <span className="text-white">Enable Aura Display</span>
                </label>
              </div>

              {/* Squad Overclock Info */}
              <div className="bg-gradient-to-br from-yellow-500/20 to-red-500/20 backdrop-blur-xl rounded-2xl p-6 border border-yellow-500/30">
                <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-yellow-500" />
                  Squad Overclock
                </h3>
                <p className="text-zinc-300 text-sm">
                  Press the ⚡ button during voice calls to boost everyone to 4K/60FPS. 
                  Your friends will love you for this.
                </p>
              </div>

              <Button 
                onClick={handleSave} 
                className="bg-gradient-to-r from-[#FF3333] to-purple-600 hover:from-red-500 hover:to-purple-500 text-white font-bold mt-4 w-full shadow-[0_0_20px_rgba(255,51,51,0.3)]"
                disabled={updateProfileMutation.isPending}
              >
                <Sparkles className="w-4 h-4 mr-2" />
                {updateProfileMutation.isPending ? 'Deploying...' : 'Deploy Apex Configurations'}
              </Button>
            </div>
          </TabsContent>
        </div>
      </Tabs>

      {/* Image Cropper Modal - Moved outside Tabs */}
      <ImageCropper
        open={cropperConfig.open}
        onClose={() => setCropperConfig({ open: false, src: null, type: null })}
        imageSrc={cropperConfig.src}
        aspectRatio={cropperConfig.aspectRatio}
        onCropComplete={handleCropComplete}
        title={cropperConfig.type === 'avatar_url' ? 'Crop Profile Picture' : 'Crop Banner'}
      />

      {/* Unsaved Changes Bar */}
      <AnimatePresence>
        {hasUnsavedChanges && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-yellow-600/90 backdrop-blur-xl text-white px-6 py-3 rounded-full shadow-2xl z-50 flex items-center gap-4"
          >
            <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
            <span className="font-medium">You have unsaved changes</span>
            <Button size="sm" onClick={handleSave} className="bg-white text-yellow-600 hover:bg-zinc-100">
              Save Now
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* APEX Store */}
      <ApexStore isOpen={showApexStore} onClose={() => setShowApexStore(false)} currentTier={profile?.apex_tier} currentUser={currentUser} profile={profile} />
    </div>
  );
}

/**
 * DockPreferencesCard — toggles the FloatingDock visibility and collapsed
 * state. Both preferences are persisted in localStorage and read by
 * FloatingDock on mount. We fire a custom event so the dock updates
 * without requiring a page reload.
 */
function DockPreferencesCard() {
  const [enabled, setEnabled] = React.useState(() => {
    try { return localStorage.getItem('spidr_dock_enabled') !== 'false'; } catch { return true; }
  });
  const [collapsed, setCollapsed] = React.useState(() => {
    try { return localStorage.getItem('spidr_dock_collapsed') === 'true'; } catch { return false; }
  });

  const persist = (k, v) => {
    try { localStorage.setItem(k, String(v)); } catch {}
    window.dispatchEvent(new Event('spidr-dock-pref-changed'));
  };

  return (
    <div className="bg-zinc-800/50 backdrop-blur-xl rounded-2xl p-6 border border-red-900/20">
      <h3 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-red-500" />
        Floating Dock
      </h3>
      <p className="text-zinc-400 text-xs mb-4">
        The bar at the bottom of the screen with quick-action buttons.
      </p>
      <div className="space-y-3">
        <label className="flex items-center justify-between gap-3 cursor-pointer">
          <div className="min-w-0">
            <p className="text-white text-sm font-semibold">Show floating dock</p>
            <p className="text-zinc-500 text-xs">Always visible at the bottom of every page.</p>
          </div>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => { setEnabled(e.target.checked); persist('spidr_dock_enabled', e.target.checked); }}
            className="w-5 h-5 accent-red-600 cursor-pointer flex-shrink-0"
          />
        </label>
        <label className={`flex items-center justify-between gap-3 ${enabled ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'}`}>
          <div className="min-w-0">
            <p className="text-white text-sm font-semibold">Start collapsed</p>
            <p className="text-zinc-500 text-xs">Shows only a handle until you expand it. You can also use the chevron above the dock to toggle anytime.</p>
          </div>
          <input
            type="checkbox"
            checked={collapsed}
            disabled={!enabled}
            onChange={(e) => { setCollapsed(e.target.checked); persist('spidr_dock_collapsed', e.target.checked); }}
            className="w-5 h-5 accent-red-600 cursor-pointer flex-shrink-0"
          />
        </label>
      </div>
    </div>
  );
}
