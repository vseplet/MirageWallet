import { Container } from "pixi.js";
import { createTitle, createText, type Screen } from "@/ui";
import { send } from "@/state";
import { PADDING, COLORS } from "@/config";
import { validateMnemonic } from "@/ton";
import { createSeedInput } from "@/seed-input";

export function importScreen(): Screen {
  const c = new Container();

  const title = createTitle("Import Wallet");
  title.x = PADDING;
  title.y = 14;
  c.addChild(title);

  const hint = createText("Enter seed phrase word by word.", {
    fontSize: 12,
    color: COLORS.textDim,
  });
  hint.x = PADDING;
  hint.y = 44;
  c.addChild(hint);

  const seedInput = createSeedInput({
    onComplete: async (words) => {
      hint.text = "Validating...";

      const valid = await validateMnemonic(words);
      if (!valid) {
        hint.text = "Invalid mnemonic. Please try again.";
        hint.style.fill = COLORS.danger;
        return;
      }

      send({ type: "MNEMONIC_VALID", mnemonic: words });
    },
    onBack: () => send({ type: "BACK" }),
  });

  // Offset seed input below title
  seedInput.container.y = 50;
  c.addChild(seedInput.container);

  return { container: c };
}
