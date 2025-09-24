## Error Type
Runtime ReferenceError

## Error Message
Cannot access 'goPrev' before initialization


    at ImmersiveGalleryContent (src/app/gallery/immersive/page.tsx:120:7)
    at ImmersiveGalleryPage (src/app/gallery/immersive/page.tsx:58:7)

## Code Frame
  118 |     window.addEventListener('keydown', onKeyDown);
  119 |     return () => window.removeEventListener('keydown', onKeyDown);
> 120 |   }, [goPrev, goNext, showConclusion]);
      |       ^
  121 |
  122 |   // 测试作品数据
  123 |   const testArtworks: ImmersiveArtwork[] = [

Next.js version: 15.5.3 (Webpack)
