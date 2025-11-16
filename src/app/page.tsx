// app/page.tsx
type Problem = {
  id: string;
  question: string;
};

const problems: Problem[] = [
  { id: 'p1', question: '문제 1: 여기에 첫 번째 문항 텍스트를 넣으세요.' },
  { id: 'p2', question: '문제 2: 여기에 두 번째 문항 텍스트를 넣으세요.' },
];

export default function Page() {
  return (
    <main className="min-h-screen p-8">
      <h1 className="text-2xl font-bold mb-6">온라인 워크북 (테스트 버전)</h1>

      <div className="space-y-4">
        {problems.map((p, idx) => (
          <section
            key={p.id}
            className="border rounded-lg p-4 shadow-sm bg-white"
          >
            <div className="font-semibold mb-2">
              {idx + 1}. {p.question}
            </div>

            <textarea
              className="w-full border rounded-md p-2 text-sm"
              rows={4}
              placeholder="여기에 풀이를 적어보세요."
            />
          </section>
        ))}
      </div>
    </main>
  );
}
