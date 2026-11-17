// Sustituto de 'react-native' para el código de src/ en Android (lo enlaza metro.config.js):
// reexporta todo igual, salvo Text y TextInput, que agregan la tipografía de la app (Roboto incluida
// en el APK; ver components/appFont.ts). El estilo del componente va después, así que un
// fontFamily explícito sigue mandando. Este archivo importa el 'react-native' real.
import { type ComponentRef, createElement, forwardRef } from 'react';
import * as RN from 'react-native';
import { APP_FONT } from '@/components/appFont';

export * from 'react-native';

export const Text = forwardRef<ComponentRef<typeof RN.Text>, RN.TextProps>(function Text(props, ref) {
  return createElement(RN.Text, { ...props, ref, style: [APP_FONT, props.style] });
});

export const TextInput = forwardRef<ComponentRef<typeof RN.TextInput>, RN.TextInputProps>(function TextInput(props, ref) {
  return createElement(RN.TextInput, { ...props, ref, style: [APP_FONT, props.style] });
});
