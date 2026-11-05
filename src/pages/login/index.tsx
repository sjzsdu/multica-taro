import { useEffect, useRef, useState } from 'react'
import { View, Text, Input } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useAuthStore } from '@/stores/auth-store'
import { errorMessage } from '@/api/client'
import './index.scss'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function LoginPage() {
  const status = useAuthStore((state) => state.status)
  const sendCode = useAuthStore((state) => state.sendCode)
  const login = useAuthStore((state) => state.login)

  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [pending, setPending] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [error, setError] = useState('')
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (status === 'authenticated') {
      Taro.switchTab({ url: '/pages/inbox/index' })
    }
  }, [status])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  const startCountdown = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    setCountdown(60)
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const handleSendCode = async () => {
    const value = email.trim().toLowerCase()
    if (!value) {
      setError('请输入邮箱地址')
      return
    }
    if (!EMAIL_PATTERN.test(value)) {
      setError('邮箱格式不正确')
      return
    }

    setPending(true)
    setError('')
    try {
      await sendCode(value)
      setEmail(value)
      setStep('code')
      startCountdown()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setPending(false)
    }
  }

  const handleVerify = async () => {
    const value = code.trim()
    if (value.length !== 6) {
      setError('请输入 6 位验证码')
      return
    }

    setPending(true)
    setError('')
    try {
      await login(email.trim().toLowerCase(), value)
      await Taro.switchTab({ url: '/pages/inbox/index' })
    } catch (err) {
      setError(errorMessage(err))
      setCode('')
    } finally {
      setPending(false)
    }
  }

  const handleResend = async () => {
    if (countdown > 0 || pending) return
    setError('')
    try {
      await sendCode(email.trim().toLowerCase())
      startCountdown()
      Taro.showToast({ title: '验证码已重新发送', icon: 'none' })
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <View className='login'>
      <View className='login__hero'>
        <View className='login__mark'>
          <Text className='login__mark-text'>M</Text>
        </View>
        <Text className='login__brand'>Multica</Text>
        <Text className='login__tagline'>人和智能体协作处理任务的地方</Text>
      </View>

      <View className='login__card'>
        {step === 'email' ? (
          <>
            <Text className='login__heading'>登录工作区</Text>
            <Text className='login__hint'>我们会向你的邮箱发送一次性验证码。</Text>

            <View className='login__field'>
              <Text className='field-label'>邮箱</Text>
              <Input
                className='text-field login__input'
                type='text'
                placeholder='you@example.com'
                placeholderClass='input-placeholder'
                value={email}
                onInput={(event) => {
                  setEmail(event.detail.value)
                  setError('')
                }}
                onConfirm={handleSendCode}
                confirmType='send'
                maxlength={120}
              />
            </View>

            {error ? <Text className='login__error'>{error}</Text> : null}

            <View
              className={`login__submit ${pending || !email.trim() ? 'is-disabled' : ''}`}
              onClick={handleSendCode}
            >
              <Text className='login__submit-text'>{pending ? '发送中…' : '发送验证码'}</Text>
            </View>
          </>
        ) : (
          <>
            <Text className='login__heading'>输入验证码</Text>
            <Text className='login__hint'>验证码已发送至 {email}</Text>

            <View className='login__field'>
              <Text className='field-label'>6 位验证码</Text>
              <Input
                className='text-field login__input login__input--code'
                type='number'
                placeholder='000000'
                placeholderClass='input-placeholder'
                value={code}
                maxlength={6}
                focus
                onInput={(event) => {
                  setCode(event.detail.value.replace(/\D/g, '').slice(0, 6))
                  setError('')
                }}
                onConfirm={handleVerify}
                confirmType='done'
              />
            </View>

            {error ? <Text className='login__error'>{error}</Text> : null}

            <View
              className={`login__submit ${pending || code.length !== 6 ? 'is-disabled' : ''}`}
              onClick={handleVerify}
            >
              <Text className='login__submit-text'>{pending ? '登录中…' : '登录'}</Text>
            </View>

            <View className='login__footer'>
              <Text className='login__link' onClick={handleResend}>
                {countdown > 0 ? `${countdown}s 后可重新发送` : '重新发送验证码'}
              </Text>
              <Text
                className='login__link login__link--muted'
                onClick={() => {
                  if (pending) return
                  setStep('email')
                  setCode('')
                  setError('')
                }}
              >
                更换邮箱
              </Text>
            </View>
          </>
        )}
      </View>

      <Text className='login__legal'>登录即表示你同意 Multica 的服务条款与隐私政策</Text>
    </View>
  )
}
