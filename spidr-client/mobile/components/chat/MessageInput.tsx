import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, Alert } from 'react-native';
import { Send, ImagePlus, Smile, Mic, Zap, Ghost } from 'lucide-react-native';

export function MessageInput({
  onSend,
  disabled,
  placeholder,
}: {
  onSend: (text: string) => Promise<void> | void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      await onSend(trimmed);
      setText('');
    } finally {
      setBusy(false);
    }
  };

  const stub = (label: string) =>
    Alert.alert('Coming soon', `${label} from mobile is landing in a follow-up patch.`);

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 8,
        paddingBottom: 14,
        backgroundColor: '#0a0a0a',
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.06)',
        gap: 6,
      }}
    >
      {/* Leading icons */}
      <TouchableOpacity onPress={() => stub('Image upload')} style={{ padding: 6 }} hitSlop={6}>
        <ImagePlus size={20} color="#71717a" />
      </TouchableOpacity>
      <TouchableOpacity onPress={() => stub('Ghost mode')} style={{ padding: 6 }} hitSlop={6}>
        <Ghost size={20} color="#71717a" />
      </TouchableOpacity>

      {/* Input */}
      <View
        style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: '#1a1a1a',
          borderRadius: 999,
          paddingHorizontal: 14,
          minHeight: 40,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.06)',
        }}
      >
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={placeholder || 'Message...'}
          placeholderTextColor="#52525b"
          multiline
          editable={!disabled && !busy}
          style={{
            flex: 1,
            color: '#fff',
            fontSize: 14,
            maxHeight: 120,
            paddingVertical: 8,
          }}
        />
        <TouchableOpacity onPress={() => stub('Emoji picker')} style={{ paddingHorizontal: 4 }} hitSlop={6}>
          <Smile size={18} color="#71717a" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => stub('Quick reactions')} style={{ paddingHorizontal: 4 }} hitSlop={6}>
          <Zap size={18} color="#71717a" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => stub('Voice notes')} style={{ paddingHorizontal: 4 }} hitSlop={6}>
          <Mic size={18} color="#71717a" />
        </TouchableOpacity>
      </View>

      {/* Send */}
      <TouchableOpacity
        onPress={submit}
        disabled={!text.trim() || busy}
        style={{
          backgroundColor: text.trim() ? '#dc2626' : '#3f3f46',
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Send color="#fff" size={18} />
      </TouchableOpacity>
    </View>
  );
}
