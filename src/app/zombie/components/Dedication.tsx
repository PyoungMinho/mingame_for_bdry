import Image from 'next/image';

/**
 * 엔딩 크레딧 헌정. PM 요청 문구 그대로 — 어떤 엔딩이든 마지막에 나온다.
 * 사진은 public/zombie/dedication.jpg (EXIF 제거본).
 */
export function Dedication() {
  return (
    <section className="zb-dedication" aria-label="헌정">
      <figure className="zb-polaroid">
        <span className="zb-tape" aria-hidden />
        <Image src="/zombie/dedication.jpg" alt="김성준" width={360} height={480} sizes="(max-width: 520px) 62vw, 280px" />
      </figure>
      <p className="zb-dedication-text">대한민국 첫번째 좀비 김성준에게 바칩니다</p>
    </section>
  );
}
