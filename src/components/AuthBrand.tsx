import { BrandIcon } from './BrandIcon'

// Logo tile, name and tagline shown above the sign-in style cards.
export default function AuthBrand({ subtitle }: { subtitle: string }) {
  return (
    <div className="auth-brand">
      <span className="brand-tile brand-tile-large" aria-hidden="true">
        <BrandIcon size={24} />
      </span>
      <h1>Flowboard</h1>
      <p className="auth-sub">{subtitle}</p>
    </div>
  )
}
