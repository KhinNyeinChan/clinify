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
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/services/supabase';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;
const SIGN_IN_TIMEOUT_MS = 15000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(
        new Error(
          'Could not reach Supabase. Check the phone’s internet connection, then try again.',
        ),
      );
    }, ms);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error('Something went wrong. Try again.'));
      },
    );
  });
}

type FieldErrors = {
  email?: string;
  password?: string;
};

function validate(email: string, password: string): FieldErrors {
  const errors: FieldErrors = {};
  const trimmedEmail = email.trim();

  if (!trimmedEmail) {
    errors.email = 'Enter your email address.';
  } else if (!EMAIL_PATTERN.test(trimmedEmail)) {
    errors.email = 'Enter a valid email address.';
  }

  if (!password) {
    errors.password = 'Enter your password.';
  } else if (password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }

  return errors;
}

export function LoginScreen() {
  const theme = useTheme();
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
    const nextErrors = validate(email, password);
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
      );

      if (error) {
        setFormError(error.message);
        return;
      }

      if (!data.session) {
        setFormError('Sign-in did not return a session. Confirm your email, then try again.');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Something went wrong. Try again.';
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
              Sign in to your clinic
            </Text>
          </View>

          <Card>
            <Field
              label="Email"
              value={email}
              error={fieldErrors.email}
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              editable={!submitting}
              inputMode="email"
              keyboardType="email-address"
              placeholder="you@clinic.com"
              returnKeyType="next"
              textContentType="emailAddress"
              onChangeText={updateEmail}
              onSubmitEditing={() => passwordRef.current?.focus()}
            />
            <Field
              label="Password"
              ref={passwordRef}
              value={password}
              error={fieldErrors.password}
              autoCapitalize="none"
              autoComplete="password"
              autoCorrect={false}
              editable={!submitting}
              placeholder="Your password"
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
              label="Log in"
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
