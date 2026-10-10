// Used when the server's answer is not JSON, for example when Vercel cut a
// slow request off and sent its own plain-text error page instead.
export const slowAnswer = () => ({
  error: "The server took too long to answer. Please try again. / सर्वर ने देर कर दी, फिर से कोशिश करें।",
});
