import DateTimePicker from '@react-native-community/datetimepicker';
import Ionicons from '@expo/vector-icons/Ionicons';
import { type ComponentProps, type ReactNode, forwardRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { CardShadow, Palette, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function ScreenScroll({
  children,
  withTabBar = true,
}: {
  children: ReactNode;
  withTabBar?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  return (
    <View style={[styles.flex, { backgroundColor: theme.background }]}>
      <SafeAreaView style={styles.flex} edges={['top', 'left', 'right']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            style={styles.flex}
            contentContainerStyle={[
              styles.content,
              {
                paddingTop: Spacing.four,
                paddingBottom: (withTabBar ? 96 : Spacing.four) + insets.bottom,
              },
            ]}
            contentInsetAdjustmentBehavior="never"
            keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

export function IconButton({
  name,
  onPress,
  accessibilityLabel,
  variant = 'plain',
  disabled = false,
}: {
  name: ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
  accessibilityLabel: string;
  variant?: 'plain' | 'accent' | 'delete';
  disabled?: boolean;
}) {
  const theme = useTheme();
  const iconColor =
    variant === 'delete' ? Palette.deleteIcon : variant === 'accent' ? Palette.primary : theme.text;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      hitSlop={8}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        variant === 'accent' && styles.iconButtonAccent,
        variant === 'delete' && styles.iconButtonDelete,
        { opacity: disabled ? 0.4 : pressed ? 0.72 : 1 },
      ]}>
      <Ionicons name={name} size={22} color={iconColor} />
    </Pressable>
  );
}

export function ListRowActions({
  disabled = false,
  onEdit,
  onDelete,
}: {
  disabled?: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <View style={styles.listRowActions}>
      <IconButton
        name="create-outline"
        accessibilityLabel="Edit"
        disabled={disabled}
        onPress={onEdit}
      />
      <IconButton
        name="trash-outline"
        variant="delete"
        accessibilityLabel="Delete"
        disabled={disabled}
        onPress={onDelete}
      />
    </View>
  );
}

export function ConfirmDialog({
  visible,
  message,
  loading = false,
  onYes,
  onNo,
}: {
  visible: boolean;
  message: string;
  loading?: boolean;
  onYes: () => void;
  onNo: () => void;
}) {
  const theme = useTheme();

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onNo}>
      <View style={styles.dialogOverlay}>
        <Pressable style={StyleSheet.absoluteFill} disabled={loading} onPress={onNo} />
        <View style={[styles.dialogCard, { backgroundColor: theme.backgroundElement }]}>
          <Text style={[styles.dialogMessage, { color: theme.text }]}>{message}</Text>
          <View style={styles.dialogActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="No"
              disabled={loading}
              onPress={onNo}
              style={({ pressed }) => [
                styles.dialogButton,
                styles.dialogNo,
                { borderColor: theme.border, opacity: pressed || loading ? 0.72 : 1 },
              ]}>
              <Text style={[styles.dialogButtonLabel, { color: theme.text }]}>No</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Yes"
              disabled={loading}
              onPress={onYes}
              style={({ pressed }) => [
                styles.dialogButton,
                styles.dialogYes,
                { opacity: pressed || loading ? 0.72 : 1 },
              ]}>
              {loading ? (
                <ActivityIndicator color={Palette.white} />
              ) : (
                <Text style={[styles.dialogButtonLabel, { color: Palette.white }]}>Yes</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function ScreenNavHeader({
  title,
  onBack,
  right,
}: {
  title: string;
  onBack?: () => void;
  right?: ReactNode;
}) {
  const theme = useTheme();

  return (
    <View style={styles.navHeader}>
      {onBack ? (
        <IconButton name="arrow-back" accessibilityLabel="Go back" onPress={onBack} />
      ) : (
        <View style={styles.iconButton} />
      )}
      <Text style={[styles.navTitle, { color: theme.text }]} numberOfLines={1}>
        {title}
      </Text>
      {right ?? <View style={styles.iconButton} />}
    </View>
  );
}

export function ScreenHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const theme = useTheme();

  return (
    <View style={styles.header}>
      <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{subtitle}</Text>
      ) : null}
    </View>
  );
}

export function TopTabs({
  tabs,
  value,
  onChange,
}: {
  tabs: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  const theme = useTheme();

  return (
    <View style={[styles.topTabs, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      {tabs.map((tab) => {
        const selected = tab.value === value;
        return (
          <Pressable
            key={tab.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(tab.value)}
            style={[
              styles.topTab,
              selected && { backgroundColor: Palette.primary },
            ]}>
            <Text
              style={[
                styles.topTabLabel,
                { color: selected ? Palette.white : theme.textSecondary },
              ]}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Card({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();

  return (
    <View style={[styles.card, CardShadow, { backgroundColor: theme.backgroundElement }, style]}>
      {children}
    </View>
  );
}

export function SectionTitle({ children }: { children: string }) {
  const theme = useTheme();
  return <Text style={[styles.sectionTitle, { color: theme.text }]}>{children}</Text>;
}

function SelectMenu({
  visible,
  title,
  emptyMessage,
  children,
  headerRight,
  onClose,
}: {
  visible: boolean;
  title: string;
  emptyMessage?: string;
  children?: ReactNode;
  headerRight?: ReactNode;
  onClose: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View style={[styles.selectOverlay, { paddingTop: insets.top + Spacing.two }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.selectSheet, { backgroundColor: theme.backgroundElement }]}>
          <View style={styles.selectSheetHeader}>
            <Text style={[styles.selectSheetTitle, { color: theme.text }]} numberOfLines={1}>
              {title}
            </Text>
            {headerRight}
          </View>
          {children ?? (
            <Text style={[styles.empty, { color: theme.textSecondary }]}>
              {emptyMessage ?? 'No options yet.'}
            </Text>
          )}
        </View>
      </View>
    </Modal>
  );
}

export const Field = forwardRef<
  TextInput,
  {
    label: string;
    error?: string;
  } & ComponentProps<typeof TextInput>
>(function Field({ label, error, style, multiline, ...inputProps }, ref) {
  const theme = useTheme();

  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
      <TextInput
        ref={ref}
        placeholderTextColor={theme.textSecondary}
        multiline={multiline}
        {...inputProps}
        style={[
          styles.input,
          multiline && styles.multiline,
          {
            color: theme.text,
            backgroundColor: theme.background,
            borderColor: error ? Palette.error : theme.border,
          },
          style,
        ]}
      />
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
});

export function SelectField({
  label,
  placeholder,
  value,
  options,
  error,
  disabled = false,
  highlightColor = Palette.primary,
  highlightBackground = Palette.accent,
  onChange,
  onCreate,
  onUpdate,
  onRemove,
}: {
  label: string;
  placeholder: string;
  value: string | null;
  options: { value: string; label: string }[];
  error?: string;
  disabled?: boolean;
  highlightColor?: string;
  highlightBackground?: string;
  onChange: (value: string) => void;
  onCreate?: (name: string) => Promise<{ value: string; label: string }>;
  onUpdate?: (id: string, name: string) => Promise<{ value: string; label: string }>;
  onRemove?: (id: string) => Promise<void>;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [formBusy, setFormBusy] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const selected = options.find((option) => option.value === value);
  const canCreate = Boolean(onCreate);
  const canManage = Boolean(onUpdate || onRemove);

  function close() {
    setOpen(false);
    setMode('list');
    setEditingId(null);
    setNewName('');
    setFormError(null);
    setFormBusy(false);
    setPendingDeleteId(null);
    setDeleting(false);
  }

  function backToList() {
    setMode('list');
    setEditingId(null);
    setNewName('');
    setFormError(null);
  }

  async function saveForm() {
    const name = newName.trim();
    if (!name) {
      setFormError('Enter a category name.');
      return;
    }

    setFormBusy(true);
    setFormError(null);
    try {
      if (mode === 'create' && onCreate) {
        const created = await onCreate(name);
        onChange(created.value);
        close();
        return;
      }

      if (mode === 'edit' && editingId && onUpdate) {
        await onUpdate(editingId, name);
        backToList();
      }
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : mode === 'edit'
            ? 'Could not update the category.'
            : 'Could not add the category.',
      );
    } finally {
      setFormBusy(false);
    }
  }

  async function confirmDelete() {
    if (!pendingDeleteId || !onRemove) {
      return;
    }

    setDeleting(true);
    try {
      await onRemove(pendingDeleteId);
      setPendingDeleteId(null);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not delete the category.');
      setPendingDeleteId(null);
    } finally {
      setDeleting(false);
    }
  }

  const sheetTitle = mode === 'create' ? 'New category' : mode === 'edit' ? 'Edit category' : label;

  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled, expanded: open }}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.input,
          styles.selectTrigger,
          {
            backgroundColor: theme.background,
            borderColor: error ? Palette.error : theme.border,
            opacity: disabled ? 0.55 : pressed ? 0.86 : 1,
          },
        ]}>
        <Text
          numberOfLines={1}
          style={[styles.selectValue, { color: selected ? theme.text : theme.textSecondary }]}>
          {selected?.label ?? placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={theme.textSecondary} />
      </Pressable>
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}

      <SelectMenu
        visible={open}
        title={sheetTitle}
        emptyMessage="No options yet."
        onClose={close}
        headerRight={
          canCreate && mode === 'list' ? (
            <IconButton
              name="add"
              variant="accent"
              accessibilityLabel="Add category"
              onPress={() => {
                setMode('create');
                setFormError(null);
                setNewName('');
              }}
            />
          ) : undefined
        }>
        {mode !== 'list' && (mode === 'create' ? canCreate : Boolean(onUpdate)) ? (
          <View style={styles.selectCreate}>
            <TextInput
              value={newName}
              editable={!formBusy}
              placeholder="Category name"
              placeholderTextColor={theme.textSecondary}
              autoFocus
              onChangeText={(value) => {
                setNewName(value);
                setFormError(null);
              }}
              style={[
                styles.input,
                {
                  color: theme.text,
                  backgroundColor: theme.background,
                  borderColor: formError ? Palette.error : theme.border,
                },
              ]}
            />
            {formError ? <Text style={styles.fieldError}>{formError}</Text> : null}
            <PrimaryButton
              label={mode === 'edit' ? 'Save' : 'Add'}
              loading={formBusy}
              color={highlightColor}
              pressedColor={Palette.primaryPressed}
              onPress={() => {
                void saveForm();
              }}
            />
            <Pressable accessibilityRole="button" disabled={formBusy} onPress={backToList}>
              <Text style={[styles.selectCreateCancel, { color: theme.textSecondary }]}>Cancel</Text>
            </Pressable>
          </View>
        ) : options.length === 0 ? (
          formError ? <Text style={styles.fieldError}>{formError}</Text> : undefined
        ) : (
          <ScrollView style={styles.selectOptions} keyboardShouldPersistTaps="handled">
            {formError ? <Text style={styles.fieldError}>{formError}</Text> : null}
            {options.map((option) => {
              const isSelected = option.value === value;
              return (
                <View
                  key={option.value}
                  style={[
                    styles.selectOption,
                    isSelected && { backgroundColor: highlightBackground },
                  ]}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      onChange(option.value);
                      close();
                    }}
                    style={styles.selectOptionMain}>
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.selectOptionLabel,
                        { color: isSelected ? highlightColor : theme.text },
                      ]}>
                      {option.label}
                    </Text>
                  </Pressable>
                  {canManage ? (
                    <ListRowActions
                      disabled={deleting}
                      onEdit={() => {
                        if (!onUpdate) {
                          return;
                        }
                        setMode('edit');
                        setEditingId(option.value);
                        setNewName(option.label);
                        setFormError(null);
                      }}
                      onDelete={() => {
                        if (!onRemove) {
                          return;
                        }
                        setPendingDeleteId(option.value);
                      }}
                    />
                  ) : isSelected ? (
                    <Ionicons name="checkmark" size={18} color={highlightColor} />
                  ) : null}
                </View>
              );
            })}
          </ScrollView>
        )}
      </SelectMenu>

      <ConfirmDialog
        visible={pendingDeleteId != null}
        message="Are you sure you want to delete this category?"
        loading={deleting}
        onNo={() => {
          if (!deleting) {
            setPendingDeleteId(null);
          }
        }}
        onYes={() => {
          void confirmDelete();
        }}
      />
    </View>
  );
}

export function ComboField({
  label,
  placeholder,
  value,
  options,
  error,
  disabled = false,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  options: { value: string; label: string }[];
  error?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  function close() {
    setOpen(false);
  }

  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
      <View
        style={[
          styles.input,
          styles.selectTrigger,
          styles.comboWrap,
          {
            backgroundColor: theme.background,
            borderColor: error ? Palette.error : theme.border,
            opacity: disabled ? 0.55 : 1,
          },
        ]}>
        <TextInput
          editable={!disabled}
          placeholder={placeholder}
          placeholderTextColor={theme.textSecondary}
          value={value}
          onChangeText={onChange}
          style={[styles.selectValue, styles.comboInput, { color: theme.text }]}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Choose ${label} from inventory`}
          disabled={disabled || options.length === 0}
          hitSlop={8}
          onPress={() => setOpen(true)}>
          <Ionicons name="chevron-down" size={18} color={theme.textSecondary} />
        </Pressable>
      </View>
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}

      <SelectMenu
        visible={open}
        title="Inventory"
        emptyMessage="No medicines in inventory."
        onClose={close}>
        {options.length === 0 ? undefined : (
          <ScrollView style={styles.selectOptions} keyboardShouldPersistTaps="handled">
            {options.map((option) => {
              const isSelected = option.label === value;
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="button"
                  onPress={() => {
                    onChange(option.label);
                    close();
                  }}
                  style={[
                    styles.selectOption,
                    isSelected && { backgroundColor: Palette.accent },
                  ]}>
                  <Text
                    style={[
                      styles.selectOptionLabel,
                      { color: isSelected ? Palette.primary : theme.text },
                    ]}>
                    {option.label}
                  </Text>
                  {isSelected ? (
                    <Ionicons name="checkmark" size={18} color={Palette.primary} />
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </SelectMenu>
    </View>
  );
}

function formatClockTime(date: Date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function TimePickerField({
  label,
  placeholder,
  value,
  error,
  disabled = false,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: Date | null;
  error?: string;
  disabled?: boolean;
  onChange: (value: Date) => void;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => value ?? new Date());

  function openPicker() {
    setDraft(value ?? new Date());
    setOpen(true);
  }

  function confirmTime(next: Date) {
    onChange(next);
    setOpen(false);
  }

  function dismissPicker() {
    setOpen(false);
  }

  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        disabled={disabled}
        onPress={openPicker}
        style={({ pressed }) => [
          styles.input,
          styles.selectTrigger,
          {
            backgroundColor: theme.background,
            borderColor: error ? Palette.error : theme.border,
            opacity: disabled ? 0.55 : pressed ? 0.86 : 1,
          },
        ]}>
        <Text
          numberOfLines={1}
          style={[styles.selectValue, { color: value ? theme.text : theme.textSecondary }]}>
          {value ? formatClockTime(value) : placeholder}
        </Text>
        <Ionicons name="time-outline" size={20} color={theme.textSecondary} />
      </Pressable>
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}

      {open && Platform.OS === 'android' ? (
        <DateTimePicker
          value={draft}
          mode="time"
          display="clock"
          is24Hour
          positiveButton={{ label: 'OK', textColor: Palette.primary }}
          negativeButton={{ label: 'CANCEL', textColor: Palette.primary }}
          onValueChange={(_event, date) => confirmTime(date)}
          onDismiss={dismissPicker}
        />
      ) : null}

      {Platform.OS !== 'android' ? (
        <Modal transparent animationType="fade" visible={open} onRequestClose={dismissPicker}>
          <View style={styles.timePickerOverlay}>
            <Pressable style={StyleSheet.absoluteFill} onPress={dismissPicker} />
            <View style={[styles.timePickerSheet, { backgroundColor: theme.backgroundElement }]}>
              <Text style={[styles.selectSheetTitle, { color: theme.text }]}>{label}</Text>
              <DateTimePicker
                value={draft}
                mode="time"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                is24Hour
                onValueChange={(_event, date) => setDraft(date)}
                onDismiss={dismissPicker}
              />
              <View style={styles.timePickerActions}>
                <Pressable onPress={dismissPicker}>
                  <Text style={styles.timePickerAction}>CANCEL</Text>
                </Pressable>
                <Pressable onPress={() => confirmTime(draft)}>
                  <Text style={styles.timePickerAction}>OK</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  color = Palette.primary,
  pressedColor = Palette.primaryPressed,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  color?: string;
  pressedColor?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: pressed && !disabled && !loading ? pressedColor : color },
        (disabled || loading) && styles.buttonDisabled,
      ]}>
      {loading ? <ActivityIndicator color={Palette.white} /> : <Text style={styles.buttonLabel}>{label}</Text>}
    </Pressable>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <View style={styles.errorBox}>
      <Text style={styles.formError}>{message}</Text>
    </View>
  );
}

export function SuccessBanner({ message }: { message: string }) {
  return (
    <View style={styles.successBox}>
      <Text style={styles.successText}>{message}</Text>
    </View>
  );
}

export function EmptyState({ message }: { message: string }) {
  const theme = useTheme();
  return <Text style={[styles.empty, { color: theme.textSecondary }]}>{message}</Text>;
}

export function SelectableRow({
  title,
  subtitle,
  selected,
  onPress,
}: {
  title: string;
  subtitle?: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.row,
        {
          backgroundColor: selected ? Palette.accent : theme.background,
          borderColor: selected ? Palette.primary : theme.border,
        },
      ]}>
      <Text style={[styles.rowTitle, { color: theme.text }]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.rowMeta, { color: theme.textSecondary }]}>{subtitle}</Text>
      ) : null}
    </Pressable>
  );
}

export function ListRow({
  title,
  subtitle,
  meta,
  badge,
}: {
  title: string;
  subtitle?: string;
  meta?: string;
  badge?: string;
}) {
  const theme = useTheme();

  return (
    <View style={[styles.row, { backgroundColor: theme.background, borderColor: theme.border }]}>
      <View style={styles.rowHeader}>
        <Text style={[styles.rowTitle, { color: theme.text, flex: 1 }]}>{title}</Text>
        {badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeLabel}>{badge}</Text>
          </View>
        ) : null}
      </View>
      {subtitle ? (
        <Text style={[styles.rowMeta, { color: theme.textSecondary }]}>{subtitle}</Text>
      ) : null}
      {meta ? <Text style={[styles.rowMeta, { color: theme.textSecondary }]}>{meta}</Text> : null}
    </View>
  );
}

export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  const theme = useTheme();

  return (
    <View style={[styles.statCard, CardShadow, { backgroundColor: theme.backgroundElement }]}>
      <View style={styles.statAccent} />
      <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{label}</Text>
      <Text style={[styles.statValue, { color: theme.text }]}>{value}</Text>
      {hint ? <Text style={[styles.statHint, { color: theme.textSecondary }]}>{hint}</Text> : null}
    </View>
  );
}

export function QuickAction({
  label,
  caption,
  onPress,
}: {
  label: string;
  caption: string;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.quickAction,
        CardShadow,
        { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.86 : 1 },
      ]}>
      <View style={styles.quickDot} />
      <Text style={[styles.quickLabel, { color: theme.text }]}>{label}</Text>
      <Text style={[styles.quickCaption, { color: theme.textSecondary }]}>{caption}</Text>
    </Pressable>
  );
}

export function LoadingMark() {
  return <ActivityIndicator color={Palette.primary} />;
}

export function firstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function deleteErrorMessage(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  if (/foreign key|violates/i.test(message)) {
    return 'This record is used elsewhere and cannot be deleted yet.';
  }
  return message;
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  header: {
    gap: Spacing.one,
    marginBottom: Spacing.one,
  },
  navHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.two,
    marginBottom: Spacing.one,
  },
  navTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 26,
    textAlign: 'center',
  },
  iconButton: {
    alignItems: 'center',
    borderRadius: Radius.pill,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  iconButtonAccent: {
    backgroundColor: Palette.secondary,
  },
  iconButtonDelete: {
    backgroundColor: Palette.deleteIconBg,
  },
  listRowActions: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  dialogOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(17, 24, 39, 0.45)',
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.three,
  },
  dialogCard: {
    borderRadius: Radius.md,
    gap: Spacing.four,
    maxWidth: 360,
    padding: Spacing.four,
    width: '100%',
  },
  dialogMessage: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
    textAlign: 'center',
  },
  dialogActions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  dialogButton: {
    alignItems: 'center',
    borderRadius: Radius.sm,
    flex: 1,
    justifyContent: 'center',
    minHeight: 48,
  },
  dialogNo: {
    borderWidth: 1,
  },
  dialogYes: {
    backgroundColor: Palette.primary,
  },
  dialogButtonLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 34,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  topTabs: {
    borderRadius: Radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    padding: 4,
  },
  topTab: {
    alignItems: 'center',
    borderRadius: Radius.pill,
    flex: 1,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: Spacing.three,
  },
  topTabLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  card: {
    borderRadius: Radius.md,
    gap: Spacing.three,
    padding: Spacing.four,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
  },
  field: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  input: {
    borderRadius: Radius.sm,
    borderWidth: 1,
    fontSize: 16,
    lineHeight: 22,
    minHeight: 52,
    paddingHorizontal: Spacing.three,
    paddingVertical: 14,
  },
  selectTrigger: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.two,
    justifyContent: 'space-between',
  },
  selectValue: {
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
  },
  comboWrap: {
    paddingVertical: 0,
    paddingRight: 12,
  },
  comboInput: {
    minHeight: 52,
    paddingVertical: 14,
  },
  selectOverlay: {
    backgroundColor: 'rgba(17, 24, 39, 0.45)',
    flex: 1,
    justifyContent: 'flex-start',
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
  },
  selectSheet: {
    borderRadius: Radius.md,
    gap: Spacing.one,
    maxHeight: '85%',
    padding: Spacing.three,
  },
  selectSheetHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.one,
    minHeight: 40,
  },
  selectSheetTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
    paddingRight: Spacing.two,
  },
  selectCreate: {
    gap: Spacing.two,
    paddingTop: Spacing.one,
  },
  selectCreateCancel: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
    paddingVertical: Spacing.two,
    textAlign: 'center',
  },
  selectOptions: {
    flexGrow: 0,
  },
  selectOption: {
    alignItems: 'center',
    borderRadius: Radius.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingLeft: Spacing.three,
    paddingRight: Spacing.one,
    paddingVertical: 4,
  },
  selectOptionMain: {
    flex: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingRight: Spacing.two,
  },
  selectOptionLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
    paddingRight: Spacing.two,
  },
  timePickerOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(17, 24, 39, 0.45)',
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.three,
  },
  timePickerSheet: {
    borderRadius: Radius.md,
    gap: Spacing.three,
    padding: Spacing.four,
    width: '100%',
    maxWidth: 360,
  },
  timePickerActions: {
    flexDirection: 'row',
    gap: Spacing.four,
    justifyContent: 'flex-end',
  },
  timePickerAction: {
    color: Palette.primary,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  multiline: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  fieldError: {
    color: Palette.error,
    fontSize: 13,
    lineHeight: 18,
  },
  errorBox: {
    backgroundColor: Palette.errorBg,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  formError: {
    color: Palette.errorText,
    fontSize: 14,
    lineHeight: 20,
  },
  successBox: {
    backgroundColor: Palette.successBg,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  successText: {
    color: Palette.success,
    fontSize: 14,
    lineHeight: 20,
  },
  button: {
    alignItems: 'center',
    backgroundColor: Palette.primary,
    borderRadius: Radius.sm,
    justifyContent: 'center',
    minHeight: 52,
  },
  buttonPressed: {
    backgroundColor: Palette.primaryPressed,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  buttonLabel: {
    color: Palette.white,
    fontSize: 16,
    fontWeight: '700',
  },
  empty: {
    fontSize: 14,
    lineHeight: 20,
  },
  row: {
    borderRadius: Radius.sm,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
  },
  rowHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: Spacing.two,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
  rowMeta: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 2,
  },
  badge: {
    backgroundColor: Palette.accent,
    borderRadius: Radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeLabel: {
    color: Palette.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  statCard: {
    borderRadius: Radius.md,
    flex: 1,
    minWidth: 104,
    overflow: 'hidden',
    padding: Spacing.three,
  },
  statAccent: {
    backgroundColor: Palette.primary,
    borderRadius: Radius.pill,
    height: 4,
    marginBottom: Spacing.two,
    width: 28,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 30,
    marginTop: 4,
  },
  statHint: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 4,
  },
  quickAction: {
    borderRadius: Radius.md,
    flexBasis: '47%',
    flexGrow: 1,
    gap: 4,
    padding: Spacing.three,
  },
  quickDot: {
    backgroundColor: Palette.accent,
    borderColor: Palette.primary,
    borderRadius: Radius.pill,
    borderWidth: 4,
    height: 16,
    marginBottom: 8,
    width: 16,
  },
  quickLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  quickCaption: {
    fontSize: 12,
    lineHeight: 16,
  },
});
