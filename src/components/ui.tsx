import { ReactNode } from 'react'
import { View, Text, Image, ScrollView } from '@tarojs/components'
import type { ITouchEvent } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { priorityMeta, statusMeta } from '@/utils/format'
import './ui.scss'

/* ------------------------------------------------------------------ */
/* Avatar                                                              */
/* ------------------------------------------------------------------ */

function initial(name?: string | null): string {
  const trimmed = (name || '').trim()
  return trimmed ? trimmed.slice(0, 1).toUpperCase() : '?'
}

/** Multica stores some agent avatars as `emoji:<char>` instead of a URL. */
function emojiAvatar(src?: string | null): string | null {
  if (src && src.startsWith('emoji:')) return src.slice('emoji:'.length)
  return null
}

export function Avatar({
  src,
  name,
  size = 'md',
}: {
  src?: string | null
  name?: string | null
  size?: 'xs' | 'sm' | 'md' | 'lg'
}) {
  const emoji = emojiAvatar(src)
  if (emoji) {
    return (
      <View className={`ui-avatar ui-avatar--${size} ui-avatar--fallback`}>
        <Text className='ui-avatar__text'>{emoji}</Text>
      </View>
    )
  }
  if (src) {
    return <Image className={`ui-avatar ui-avatar--${size}`} src={src} mode='aspectFill' />
  }
  return (
    <View className={`ui-avatar ui-avatar--${size} ui-avatar--fallback`}>
      <Text className='ui-avatar__text'>{initial(name)}</Text>
    </View>
  )
}

/* ------------------------------------------------------------------ */
/* Badges                                                              */
/* ------------------------------------------------------------------ */

export function StatusBadge({
  status,
  name,
  compact,
}: {
  status: string | null | undefined
  name?: string
  compact?: boolean
}) {
  const meta = statusMeta(status, name)
  return (
    <Text
      className={`ui-status ${compact ? 'ui-status--compact' : ''}`}
      style={{ color: meta.color, background: meta.background }}
    >
      {meta.label}
    </Text>
  )
}

export function PriorityMark({
  priority,
  showLabel,
}: {
  priority: string | null | undefined
  showLabel?: boolean
}) {
  const meta = priorityMeta(priority)
  const level = meta.rank
  return (
    <View className='ui-priority'>
      <View className='ui-priority__bars'>
        {[1, 2, 3].map((step) => (
          <View
            key={step}
            className={`ui-priority__bar ${step <= Math.max(level, 1) && level > 0 ? 'is-on' : ''}`}
            style={{
              background: step <= level ? meta.color : '#D0D5DD',
              height: `${6 + step * 3}px`,
            }}
          />
        ))}
      </View>
      {showLabel ? <Text className='ui-priority__label'>{meta.label}</Text> : null}
    </View>
  )
}

export function Badge({ count, dot }: { count?: number; dot?: boolean }) {
  if (dot) return <View className='ui-badge-dot' />
  if (!count) return null
  return <Text className='ui-badge'>{count > 99 ? '99+' : count}</Text>
}

/* ------------------------------------------------------------------ */
/* Chips / segmented control                                           */
/* ------------------------------------------------------------------ */

export function Chip({
  active,
  children,
  onClick,
}: {
  active?: boolean
  children: ReactNode
  onClick?: () => void
}) {
  return (
    <View className={`ui-chip ${active ? 'is-active' : ''}`} onClick={onClick}>
      <Text className='ui-chip__text'>{children}</Text>
    </View>
  )
}

/* ------------------------------------------------------------------ */
/* Empty / loading / error                                             */
/* ------------------------------------------------------------------ */

export function Spinner({ label }: { label?: string }) {
  return (
    <View className='ui-center'>
      <View className='ui-spinner' />
      {label ? <Text className='ui-center__text'>{label}</Text> : null}
    </View>
  )
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <View className='ui-empty'>
      <View className='ui-empty__glyph'>
        <View className='ui-empty__glyph-line' />
        <View className='ui-empty__glyph-line ui-empty__glyph-line--short' />
      </View>
      <Text className='ui-empty__title'>{title}</Text>
      {description ? <Text className='ui-empty__desc'>{description}</Text> : null}
      {action ? <View className='ui-empty__action'>{action}</View> : null}
    </View>
  )
}

export function InlineError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View className='ui-error'>
      <Text className='ui-error__text'>{message}</Text>
      {onRetry ? (
        <Text className='ui-error__retry' onClick={onRetry}>
          重试
        </Text>
      ) : null}
    </View>
  )
}

/* ------------------------------------------------------------------ */
/* Sheet                                                               */
/* ------------------------------------------------------------------ */

export interface SheetOption {
  key: string
  label: string
  description?: string
  color?: string
  active?: boolean
  avatarSrc?: string | null
}

export function OptionSheet({
  visible,
  title,
  subtitle,
  options,
  onSelect,
  onClose,
  footer,
}: {
  visible: boolean
  title: string
  subtitle?: string
  options: SheetOption[]
  onSelect: (key: string) => void
  onClose: () => void
  footer?: ReactNode
}) {
  if (!visible) return null
  return (
    <View className='ui-sheet' catchMove>
      <View className='ui-sheet__mask' onClick={onClose} />
      <View className='ui-sheet__panel'>
        <View className='ui-sheet__handle' />
        <View className='ui-sheet__header'>
          <View>
            <Text className='ui-sheet__title'>{title}</Text>
            {subtitle ? <Text className='ui-sheet__subtitle'>{subtitle}</Text> : null}
          </View>
          <View className='ui-sheet__close' onClick={onClose}>
            <Text className='ui-sheet__close-text'>关闭</Text>
          </View>
        </View>
        <ScrollView scrollY className='ui-sheet__body'>
          {options.map((option) => (
            <View
              key={option.key}
              className={`ui-sheet__option ${option.active ? 'is-active' : ''}`}
              onClick={() => onSelect(option.key)}
            >
              {option.avatarSrc !== undefined ? (
                <Avatar src={option.avatarSrc} name={option.label} size='sm' />
              ) : option.color ? (
                <View className='ui-sheet__dot' style={{ background: option.color }} />
              ) : null}
              <View className='ui-sheet__option-main'>
                <Text className='ui-sheet__option-label'>{option.label}</Text>
                {option.description ? (
                  <Text className='ui-sheet__option-desc'>{option.description}</Text>
                ) : null}
              </View>
              {option.active ? <Text className='ui-sheet__check'>✓</Text> : null}
            </View>
          ))}
          {options.length === 0 ? <Text className='ui-sheet__empty'>暂无可选项</Text> : null}
        </ScrollView>
        {footer ? <View className='ui-sheet__footer'>{footer}</View> : null}
      </View>
    </View>
  )
}

/* ------------------------------------------------------------------ */
/* Misc                                                                */
/* ------------------------------------------------------------------ */

export function Chevron({ direction = 'right' }: { direction?: 'right' | 'down' | 'up' }) {
  return <View className={`ui-chevron ui-chevron--${direction}`} />
}

export function PlusIcon() {
  return (
    <View className='ui-plus'>
      <View className='ui-plus__bar ui-plus__bar--h' />
      <View className='ui-plus__bar ui-plus__bar--v' />
    </View>
  )
}

export function Divider({ spaced }: { spaced?: boolean }) {
  return <View className={`ui-divider ${spaced ? 'ui-divider--spaced' : ''}`} />
}

export function PressableRow({
  children,
  onClick,
  className,
}: {
  children: ReactNode
  onClick?: (event: ITouchEvent) => void
  className?: string
}) {
  return (
    <View className={`ui-row ${className || ''}`} onClick={onClick}>
      {children}
    </View>
  )
}

export function KeyValueRow({
  label,
  children,
  onClick,
}: {
  label: string
  children: ReactNode
  onClick?: () => void
}) {
  return (
    <View className='ui-kv' onClick={onClick}>
      <Text className='ui-kv__label'>{label}</Text>
      <View className='ui-kv__value'>
        {children}
        {onClick ? <Chevron /> : null}
      </View>
    </View>
  )
}

export function PageHeader({
  title,
  subtitle,
  right,
  children,
}: {
  title: string
  subtitle?: string
  right?: ReactNode
  children?: ReactNode
}) {
  return (
    <View className='ui-page-header'>
      <View className='ui-page-header__top'>
        <View className='ui-page-header__titles'>
          <Text className='ui-page-header__title'>{title}</Text>
          {subtitle ? <Text className='ui-page-header__subtitle'>{subtitle}</Text> : null}
        </View>
        {right ? <View className='ui-page-header__right'>{right}</View> : null}
      </View>
      {children}
    </View>
  )
}

/**
 * Header for pushed pages. Taro's H5 runtime does not render a browser-style
 * navigation bar, so child pages draw their own back affordance — otherwise a
 * standalone H5 build (or an in-app webview) has no way back.
 */
export function SubPageHeader({
  title,
  subtitle,
  right,
  fallbackUrl = '/pages/inbox/index',
}: {
  title: string
  subtitle?: string
  right?: ReactNode
  fallbackUrl?: string
}) {
  const handleBack = () => {
    const pages = Taro.getCurrentPages()
    if (pages.length > 1) {
      void Taro.navigateBack()
      return
    }
    void Taro.switchTab({ url: fallbackUrl })
  }

  return (
    <View className='ui-subheader'>
      <View className='ui-subheader__back' onClick={handleBack}>
        <View className='ui-subheader__arrow' />
      </View>
      <View className='ui-subheader__titles'>
        <Text className='ui-subheader__title'>{title}</Text>
        {subtitle ? <Text className='ui-subheader__subtitle'>{subtitle}</Text> : null}
      </View>
      {right ? <View className='ui-subheader__right'>{right}</View> : null}
    </View>
  )
}

export function PrimaryButton({
  label,
  onClick,
  loading,
  disabled,
  tone = 'primary',
}: {
  label: string
  onClick?: () => void
  loading?: boolean
  disabled?: boolean
  tone?: 'primary' | 'danger' | 'ghost'
}) {
  return (
    <View
      className={`ui-button ui-button--${tone} ${disabled || loading ? 'is-disabled' : ''}`}
      onClick={() => {
        if (disabled || loading) return
        onClick?.()
      }}
    >
      {loading ? <View className='ui-spinner ui-spinner--light' /> : null}
      <Text className='ui-button__label'>{label}</Text>
    </View>
  )
}
