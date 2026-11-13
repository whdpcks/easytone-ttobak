/* 문서를 인식하는 동안 보여줄 꽃 한 송이와 꽃말 (화면을 열 때마다 4가지 중 하나, 한국어만) */
import { useState } from 'react'
import lilyOfTheValley from '../assets/flowers/lily-of-the-valley.webp'
import freesia from '../assets/flowers/freesia.webp'
import lavender from '../assets/flowers/lavender.png'
import gerbera from '../assets/flowers/gerbera.webp'

export const FLOWERS = [
  { name: '은방울꽃', meaning: '다시 찾은 행복', quote: '행복은 생각보다 가까운 곳에 있어요.', img: lilyOfTheValley },
  { name: '프리지아', meaning: '순수, 천진난만', quote: '새로운 시작은 언제나 설레는 일이니까요.', img: freesia },
  { name: '라벤더', meaning: '기다림', quote: '기다림의 끝에는 새로운 순간이 있어요.', img: lavender },
  { name: '거베라', meaning: '희망, 신비', quote: '오늘은 또 어떤 가능성이 피어날까요?', img: gerbera },
]

export default function FlowerNote() {
  const [f] = useState(() => FLOWERS[Math.floor(Math.random() * FLOWERS.length)])
  return (
    <figure className="processing-flower">
      <img src={f.img} alt={f.name} />
      <figcaption>
        <b>{f.name}</b>
        <small>꽃말 · {f.meaning}</small>
        <q>{f.quote}</q>
      </figcaption>
    </figure>
  )
}
