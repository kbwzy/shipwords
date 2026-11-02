import { pageHead } from '@shipwords/core/seo';
import { createFileRoute, Link } from '@tanstack/react-router';
import { m } from '~/paraglide/messages.js';
import { Faq, type FaqItem, faqJsonLd, GuidePage } from '~/site/guide';
import site from '../../site.config';

// Dog version page: targets "tiny desk ai dog", "tiny desk ai dogs" and "put my dog in the tiny desk band".
// Facts come from the site's own tested model config (site.models.ts): the stage starts with five dogs;
// a dog photo replaces a performer completely (fur, face, paws, every visible hand); a mix of people and
// dogs in one job is explicitly untested, so the page says so instead of promising it.

const PATH = '/tiny-desk-ai-dogs';

const seats = () => [
  { name: m.guides_dogs_seat_lead(), note: m.guides_dogs_seat_lead_note() },
  { name: m.guides_dogs_seat_sax(), note: m.guides_dogs_seat_sax_note() },
  { name: m.guides_dogs_seat_keys(), note: m.guides_dogs_seat_keys_note() },
  { name: m.guides_dogs_seat_back(), note: m.guides_dogs_seat_back_note() },
];

const faq = (): FaqItem[] => [
  { q: m.guides_dogs_faq1_q(), a: m.guides_dogs_faq1_a({ site: site.name }) },
  { q: m.guides_dogs_faq2_q(), a: m.guides_dogs_faq2_a() },
  { q: m.guides_dogs_faq3_q(), a: m.guides_dogs_faq3_a() },
  { q: m.guides_dogs_faq4_q(), a: m.guides_dogs_faq4_a() },
  {
    q: m.guides_dogs_faq5_q(),
    a: m.guides_dogs_faq5_a({ site: site.name }),
  },
];

export const Route = createFileRoute('/tiny-desk-ai-dogs')({
  head: () =>
    pageHead(site, {
      title: m.guides_dogs_meta_title(),
      description: m.guides_dogs_meta_description(),
      path: PATH,
      jsonLd: [faqJsonLd(faq())],
    }),
  component: DogsPage,
});

function DogsPage() {
  return (
    <GuidePage
      path={PATH}
      title={m.guides_dogs_title()}
      updated={m.guides_dogs_updated()}
      intro={<p>{m.guides_dogs_intro({ site: site.name })}</p>}
    >
      <h2>{m.guides_dogs_how_heading()}</h2>
      <p>{m.guides_dogs_how_text()}</p>
      <ol>
        <li>{m.guides_dogs_how_step1()}</li>
        <li>{m.guides_dogs_how_step2()}</li>
        <li>{m.guides_dogs_how_step3()}</li>
      </ol>

      <h2>{m.guides_dogs_seats_heading()}</h2>
      <p>{m.guides_dogs_seats_text()}</p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{m.guides_dogs_seats_col_seat()}</th>
              <th>{m.guides_dogs_seats_col_note()}</th>
            </tr>
          </thead>
          <tbody>
            {seats().map((s) => (
              <tr key={s.name}>
                <td>{s.name}</td>
                <td>{s.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>{m.guides_dogs_photo_heading()}</h2>
      <ul>
        <li>{m.guides_dogs_photo_front()}</li>
        <li>{m.guides_dogs_photo_light()}</li>
        <li>{m.guides_dogs_photo_face()}</li>
        <li>{m.guides_dogs_photo_one()}</li>
      </ul>

      <h2>{m.guides_dogs_result_heading()}</h2>
      <p>{m.guides_dogs_result_text()}</p>
      <p>{m.guides_dogs_result_audio()}</p>

      <h2>{m.guides_dogs_mix_heading()}</h2>
      <p>{m.guides_dogs_mix_text()}</p>

      <p>
        {m.guides_dogs_cta_before({ site: site.name })}{' '}
        <a href="/">{m.guides_dogs_cta_link()}</a>
        {m.guides_dogs_cta_after()}{' '}
        <Link to="/how-to-make-outstanding-tiny-desk-ai-video">{m.guides_dogs_cta_howto_link()}</Link>
        {m.guides_dogs_cta_after_howto()}
      </p>

      <Faq title={m.guides_dogs_faq_title()} items={faq()} />
    </GuidePage>
  );
}
