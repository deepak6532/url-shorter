import mongoose from 'mongoose';

/**
 * One row = one shortened link.
 *
 *   { code: "a7Bz91", longUrl: "https://example.com/very/long", clicks: 3 }
 */
const urlSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, trim: true },
    longUrl: { type: String, required: true, trim: true },
    clicks: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true, versionKey: false },
);

// Used by the "already shortened this URL?" lookup on every create.
// `code` is already indexed by `unique: true` — declaring it twice warns.
urlSchema.index({ longUrl: 1 });

export const Url = mongoose.model('Url', urlSchema);
