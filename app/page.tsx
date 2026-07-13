'use client'

import { useState } from 'react'

const products = [
  { tag: '人気 No.1', name: '極上カルビ 焼肉セット', detail: '黒毛和牛カルビ 400g（2〜3人前）', price: '5,980', tone: 'kalbi' },
  { tag: 'ご褒美に', name: 'とろける厚切りタン', detail: '特製塩だれ付き 300g（2人前）', price: '4,680', tone: 'tongue' },
  { tag: '贈りものに', name: 'がみや満喫セット', detail: 'カルビ・ロース・タン 合計800g', price: '9,800', tone: 'assort' },
]

export default function Home() {
  const [cartCount, setCartCount] = useState(0)

  const addToCart = () => {
    setCartCount((count) => count + 1)
    document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="焼肉がみや ホーム">
          <span>炭火焼肉</span><strong>がみや</strong>
        </a>
        <nav><a href="#story">がみやのこだわり</a><a href="#products">商品一覧</a></nav>
        <button className="cart" onClick={() => document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' })}>
          <span>🛒</span> カート <b>{cartCount}</b>
        </button>
      </header>

      <section className="hero" id="top">
        <div className="hero-grill" aria-hidden="true"><i /><i /><i /><i /><i /></div>
        <div className="hero-copy">
          <p className="eyebrow">創業三十年、食卓に届く店の味</p>
          <h1>一枚で、<br /><em>記憶に残る。</em></h1>
          <p className="hero-text">選び抜いた黒毛和牛を、最高の状態で。<br />がみやの炭火焼肉を、ご自宅へ。</p>
          <button className="primary-button" onClick={addToCart}>お肉を選ぶ <span>→</span></button>
        </div>
        <div className="hero-caption"><span>GAMIYA'S</span><b>WAGYU</b><small>炭火の香りまで、届けたい。</small></div>
      </section>

      <section className="trust-bar">
        <p><b>全国送料無料</b><span>※北海道・沖縄を除く</span></p><i />
        <p><b>最短翌日お届け</b><span>13時までのご注文で当日発送</span></p><i />
        <p><b>冷凍便でお届け</b><span>鮮度をそのまま閉じ込めます</span></p>
      </section>

      <section className="story section" id="story">
        <div className="section-label">OUR PROMISE</div>
        <div className="story-grid">
          <div><h2>お店で食べる、<br />あのひとくちを。</h2><p>肉の目利き、切り方、そして味付け。長年磨いてきたすべてを、ご家庭の焼き網の上で再現できるように整えました。</p><p>箱を開けた瞬間から、食卓が少し特別になる。そんなお肉をお届けします。</p></div>
          <div className="meat-still"><div className="meat-slice s1" /><div className="meat-slice s2" /><div className="meat-slice s3" /><span>選び抜いた<br /><b>黒毛和牛</b></span></div>
        </div>
        <div className="values"><article><strong>01</strong><h3>一頭一頭、目利き</h3><p>肉質・脂・香りを見極め、今いちばん美味しい部位だけを選びます。</p></article><article><strong>02</strong><h3>注文を受けてから加工</h3><p>食べごろの厚みと大きさに、一枚ずつ丁寧にカット。</p></article><article><strong>03</strong><h3>美味しさを閉じ込める</h3><p>急速冷凍で鮮度を保ち、最高の状態でお届けします。</p></article></div>
      </section>

      <section className="products section" id="products">
        <div className="section-head"><div><div className="section-label">LINE UP</div><h2>今日、どれを焼く？</h2></div><a href="#products">すべての商品を見る →</a></div>
        <div className="product-grid">
          {products.map((product) => <article className="product-card" key={product.name}>
            <div className={`product-image ${product.tone}`}><span>{product.tag}</span><div className="raw-meat"><i /><i /><i /></div></div>
            <div className="product-info"><h3>{product.name}</h3><p>{product.detail}</p><div className="product-bottom"><b>¥{product.price}<small>（税込）</small></b><button onClick={() => setCartCount((count) => count + 1)} aria-label={`${product.name}をカートに入れる`}>＋</button></div></div>
          </article>)}
        </div>
      </section>

      <section className="gift"><div><p className="section-label">FOR GIFT</p><h2>大切な人に、<br />おいしい時間を贈る。</h2><p>熨斗・メッセージカードも承ります。<br />特別な日の贈りものに、がみやの和牛を。</p><button className="light-button" onClick={() => document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' })}>ギフト商品を見る →</button></div><div className="gift-box" aria-hidden="true"><span>炭火焼肉<br /><b>がみや</b></span></div></section>

      <section className="closing"><p>さあ、今日は<br /><b>いい肉を焼こう。</b></p><button className="primary-button" onClick={addToCart}>商品を選ぶ <span>→</span></button></section>
      <footer><a className="brand" href="#top"><span>炭火焼肉</span><strong>がみや</strong></a><p>© GAMIYA YAKINIKU. ALL RIGHTS RESERVED.</p></footer>
      {cartCount > 0 && <button className="floating-cart" onClick={() => document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' })}>🛒 カートを見る <b>{cartCount}</b></button>}
    </main>
  )
}
