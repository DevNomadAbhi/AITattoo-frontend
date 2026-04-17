# Custom Fonts

Place your downloaded font files here. The app is configured to load:

- `Fondamento_400Regular.ttf` - Regular weight Fondamento font
- `Fondamento_400Regular_Italic.ttf` - Italic weight (optional)

## How to add more fonts

1. Download your `.ttf` or `.otf` font files
2. Place them in this directory (`assets/fonts/`)
3. Update `app/_layout.tsx` to load them:

```typescript
await Font.loadAsync({
  FontName: require("./FontName.ttf"),
  AnotherFont: require("./AnotherFont.ttf"),
});
```

4. Update `constants/theme.ts` to reference the font:

```typescript
rounded: 'FontName',
```

The font name in `loadAsync` must match the font family name you use in styles.
