import { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, ErrorBanner, Field, PrimaryButton } from '@/components/clinic-ui';
import { Palette, Spacing } from '@/constants/theme';
import { useI18n } from '@/constants/i18n';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/services/supabase';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;
const SIGN_IN_TIMEOUT_MS = 15000;

function withTimeout<T>(promise: Promise<T>, ms: number, network: string, generic: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(network));
    }, ms);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(generic));
      },
    );
  });
}

type FieldErrors = {
  email?: string;
  password?: string;
};

function validate(
  email: string,
  password: string,
  copy: ReturnType<typeof useI18n>['login'],
): FieldErrors {
  const errors: FieldErrors = {};
  const trimmedEmail = email.trim();

  if (!trimmedEmail) {
    errors.email = copy.emailError;
  } else if (!EMAIL_PATTERN.test(trimmedEmail)) {
    errors.email = copy.emailInvalid;
  }

  if (!password) {
    errors.password = copy.passwordError;
  } else if (password.length < MIN_PASSWORD_LENGTH) {
    errors.password = copy.passwordShort;
  }

  return errors;
}

export function LoginScreen() {
  const theme = useTheme();
  const copy = useI18n().login;
  const passwordRef = useRef<TextInput>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function updateEmail(value: string) {
    setEmail(value);
    setFieldErrors((current) => ({ ...current, email: undefined }));
    setFormError(null);
  }

  function updatePassword(value: string) {
    setPassword(value);
    setFieldErrors((current) => ({ ...current, password: undefined }));
    setFormError(null);
  }

  async function signIn() {
    const nextErrors = validate(email, password, copy);
    setFieldErrors(nextErrors);
    setFormError(null);

    if (nextErrors.email || nextErrors.password) {
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await withTimeout(
        supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        }),
        SIGN_IN_TIMEOUT_MS,
        copy.network,
        copy.generic,
      );

      if (error) {
        setFormError(error.message);
        return;
      }

      if (!data.session) {
        setFormError(copy.noSession);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : copy.generic;
      setFormError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.background }]}
      edges={['top', 'left', 'right', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.content}>
          <View style={styles.brandMark}>
            <View style={styles.logoDot} />
            <Text style={[styles.brand, { color: theme.text }]}>Clinify</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              {copy.subtitle}
            </Text>
          </View>

          <Card>
            <Field
              label={copy.email}
              required
              value={email}
              error={fieldErrors.email}
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              editable={!submitting}
              inputMode="email"
              keyboardType="email-address"
              placeholder={copy.emailPlaceholder}
              returnKeyType="next"
              textContentType="emailAddress"
              onChangeText={updateEmail}
              onSubmitEditing={() => passwordRef.current?.focus()}
            />
            <Field
              label={copy.password}
              required
              ref={passwordRef}
              value={password}
              error={fieldErrors.password}
              autoCapitalize="none"
              autoComplete="password"
              autoCorrect={false}
              editable={!submitting}
              placeholder={copy.passwordPlaceholder}
              returnKeyType="go"
              secureTextEntry
              textContentType="password"
              onChangeText={updatePassword}
              onSubmitEditing={() => {
                void signIn();
              }}
            />
            {formError ? <ErrorBanner message={formError} /> : null}
            <PrimaryButton
              label={copy.submit}
              loading={submitting}
              onPress={() => {
                void signIn();
              }}
            />
          </Card>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    alignSelf: 'center',
    flex: 1,
    gap: Spacing.five,
    justifyContent: 'center',
    maxWidth: 480,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.five,
    width: '100%',
  },
  brandMark: {
    gap: Spacing.two,
  },
  logoDot: {
    backgroundColor: Palette.accent,
    borderColor: Palette.primary,
    borderRadius: 18,
    borderWidth: 6,
    height: 36,
    width: 36,
  },
  brand: {
    fontSize: 36,
    fontWeight: '700',
    lineHeight: 42,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 22,
  },
});
